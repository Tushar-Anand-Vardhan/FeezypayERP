import type { createClient } from "@/lib/supabase/server";
import { enqueueDelivery } from "@/lib/notifications/enqueue";
import type { NotifyChannel } from "@/lib/notifications/types";
import {
  mappingForEvent,
  type DomainOutboxRow,
  type OrchestratorHandlerResult,
} from "@/lib/notify-orchestration/catalog";
import {
  resolveParentsForStudent,
  resolveParentsForStudents,
  resolveSchoolAdmins,
  resolveStudentSelf,
  resolveStudentsInSection,
  type ResolvedRecipient,
} from "@/lib/notify-orchestration/audience";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function enabledChannels(
  supabase: Supabase,
  schoolId: string,
  preferred: NotifyChannel[],
): Promise<NotifyChannel[]> {
  const { data } = await supabase
    .from("notification_provider_configs")
    .select("channel, enabled")
    .eq("school_id", schoolId);

  if (!data || data.length === 0) {
    // Default: only deliver in_app until configs exist; still enqueue preferred
    // but worker stubs external. Always include in_app if in preferred.
    return preferred.includes("in_app")
      ? preferred
      : (["in_app", ...preferred] as NotifyChannel[]);
  }

  const enabled = new Set(
    data.filter((r) => r.enabled).map((r) => r.channel as NotifyChannel),
  );
  const filtered = preferred.filter((c) => enabled.has(c));
  return filtered.length > 0 ? filtered : (["in_app"] as NotifyChannel[]);
}

async function enqueueForRecipients(
  supabase: Supabase,
  input: {
    schoolId: string;
    notificationTypeCode: string;
    channels: NotifyChannel[];
    recipients: ResolvedRecipient[];
    title: string;
    body: string;
    payload: Record<string, unknown>;
    eventId: string;
  },
): Promise<number> {
  let count = 0;
  for (const recipient of input.recipients) {
    for (const channel of input.channels) {
      const result = await enqueueDelivery(supabase, {
        schoolId: input.schoolId,
        notificationTypeCode: input.notificationTypeCode,
        channel,
        recipient,
        title: input.title,
        body: input.body,
        payload: { ...input.payload, domain_event_id: input.eventId },
        idempotencyKey: `${input.eventId}:${recipient.key}:${channel}`,
      });
      if ("id" in result) {
        count += 1;
      }
    }
  }
  return count;
}

async function resolveAudience(
  supabase: Supabase,
  row: DomainOutboxRow,
): Promise<ResolvedRecipient[]> {
  const p = row.payload;

  switch (row.event_type) {
    case "attendance.record.marked": {
      if (String(p.status ?? "") !== "absent") {
        return [];
      }
      const studentId = String(p.studentProfileId ?? "");
      if (!studentId) return [];
      return resolveParentsForStudent(supabase, studentId);
    }
    case "assessment.results.published": {
      const sectionId = String(p.sectionId ?? "");
      if (!sectionId) return [];
      const students = await resolveStudentsInSection(
        supabase,
        row.school_id,
        sectionId,
        p.academicYearId ? String(p.academicYearId) : null,
      );
      const parents = await resolveParentsForStudents(
        supabase,
        students
          .map((s) => s.studentProfileId)
          .filter((id): id is string => Boolean(id)),
      );
      return [...students, ...parents];
    }
    case "conduct.incident.recorded": {
      const studentId = String(p.studentProfileId ?? "");
      const visibility = String(p.visibility ?? "staff");
      const admins = await resolveSchoolAdmins(supabase, row.school_id);
      if (!studentId) return admins;
      if (visibility === "parents" || visibility === "all") {
        const parents = await resolveParentsForStudent(supabase, studentId);
        return [...parents, ...admins];
      }
      return admins;
    }
    case "homework.assigned": {
      const sectionId = String(p.sectionId ?? "");
      if (!sectionId) return [];
      const students = await resolveStudentsInSection(
        supabase,
        row.school_id,
        sectionId,
        p.academicYearId ? String(p.academicYearId) : null,
      );
      const visibleToParents = Boolean(p.visibleToParents);
      if (!visibleToParents) return students;
      const parents = await resolveParentsForStudents(
        supabase,
        students
          .map((s) => s.studentProfileId)
          .filter((id): id is string => Boolean(id)),
      );
      return [...students, ...parents];
    }
    case "engagement.event.published": {
      return resolveSchoolAdmins(supabase, row.school_id);
    }
    case "document.artifact.issued": {
      const studentId = String(p.studentProfileId ?? "");
      if (!studentId) return [];
      const self = await resolveStudentSelf(supabase, studentId);
      const parents = await resolveParentsForStudent(supabase, studentId);
      return [...self, ...parents];
    }
    default:
      return [];
  }
}

/**
 * Map one domain outbox row to delivery requests.
 */
export async function orchestrateDomainEvent(
  supabase: Supabase,
  row: DomainOutboxRow,
): Promise<OrchestratorHandlerResult> {
  const mapping = mappingForEvent(row.event_type);
  if (!mapping) {
    return { enqueued: 0, skipped: `No mapping for ${row.event_type}` };
  }

  // Attendance only notifies on absent
  if (
    row.event_type === "attendance.record.marked" &&
    String(row.payload.status ?? "") !== "absent"
  ) {
    return { enqueued: 0, skipped: "Not an absence mark" };
  }

  const recipients = await resolveAudience(supabase, row);
  if (recipients.length === 0) {
    return { enqueued: 0, skipped: "No recipients" };
  }

  const channels = await enabledChannels(
    supabase,
    row.school_id,
    mapping.defaultChannels,
  );

  const enqueued = await enqueueForRecipients(supabase, {
    schoolId: row.school_id,
    notificationTypeCode: mapping.notificationTypeCode,
    channels,
    recipients,
    title: mapping.title(row.payload),
    body: mapping.body(row.payload),
    payload: row.payload,
    eventId: row.id,
  });

  return { enqueued };
}
