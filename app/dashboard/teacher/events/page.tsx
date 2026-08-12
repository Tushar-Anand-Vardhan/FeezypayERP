import { redirect } from "next/navigation";
import { TeacherEventsClient } from "@/components/teacher-portal/events-client";
import { canInBootstrap, getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import {
  getActivityEventDetailAction,
  listActivityEventsAction,
} from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveAcademicYearId,
  listTeacherSections,
  loadSectionRosterWithNames,
} from "@/lib/teacher-portal/server-helpers";
import { resolveTeacherEmploymentId } from "@/lib/teacher-portal/students";

type PageProps = {
  searchParams: Promise<{ employment?: string; eventId?: string }>;
};

export default async function TeacherEventsPage({ searchParams }: PageProps) {
  const authzCtx = await requirePermission("engagement.event.read");
  if ("error" in authzCtx) {
    redirect("/dashboard/teacher");
  }

  const supabase = await createClient();
  const params = await searchParams;
  const headerAuth = await getAppHeaderAuth();
  const canWrite = canInBootstrap(
    headerAuth.authz,
    "engagement.event.create",
  );

  const employmentId = await resolveTeacherEmploymentId(
    authzCtx.schoolId,
    params.employment ?? null,
  );

  const academicYearId = await getActiveAcademicYearId(
    supabase,
    authzCtx.schoolId,
  );
  if (!academicYearId) {
    return <p className="text-sm text-muted">No academic year configured.</p>;
  }

  const listed = await listActivityEventsAction({ academicYearId });
  const baseEvents = listed.success ? listed.rows : [];

  const eventIds = baseEvents.map((e) => String(e.id));
  const staffByEvent = new Map<string, string[]>();
  if (eventIds.length > 0 && employmentId) {
    const { data: staffRows } = await supabase
      .from("event_staff_assignments")
      .select("calendar_event_id, employment_id")
      .in("calendar_event_id", eventIds)
      .eq("employment_id", employmentId)
      .is("archived_at", null);
    for (const row of staffRows ?? []) {
      const eid = String(row.calendar_event_id);
      const list = staffByEvent.get(eid) ?? [];
      list.push(String(row.employment_id));
      staffByEvent.set(eid, list);
    }
  }

  const events = baseEvents.map((e) => {
    const id = String(e.id);
    return {
      id,
      title: String(e.title ?? "Event"),
      category: String(e.category ?? ""),
      startsAt: e.starts_at ? String(e.starts_at) : null,
      endsAt: e.ends_at ? String(e.ends_at) : null,
      location: e.location ? String(e.location) : null,
      approvalStatus: String(e.approval_status ?? ""),
      isCoordinator: Boolean(
        employmentId && staffByEvent.get(id)?.includes(employmentId),
      ),
    };
  });

  const selectedEventId =
    params.eventId && events.some((e) => e.id === params.eventId)
      ? params.eventId
      : (events.find((e) => e.isCoordinator)?.id ?? events[0]?.id ?? null);

  let participants: Array<{
    id: string;
    studentProfileId: string;
    fullName: string;
    attendanceStatus: string | null;
    positionLabel: string | null;
    awardLabel: string | null;
    remarks: string | null;
  }> = [];

  if (selectedEventId) {
    const detail = await getActivityEventDetailAction(selectedEventId);
    if (detail.success) {
      const profileIds = detail.participants
        .map((p) => String(p.student_profile_id ?? ""))
        .filter(Boolean);
      const nameById = new Map<string, string>();
      if (profileIds.length > 0) {
        const { data: profiles } = await supabase
          .from("student_profiles")
          .select("id, persons(full_name)")
          .in("id", profileIds);
        for (const p of profiles ?? []) {
          const person = p.persons as
            | { full_name?: string }
            | { full_name?: string }[]
            | null;
          const name = Array.isArray(person)
            ? person[0]?.full_name
            : person?.full_name;
          nameById.set(p.id, name ?? p.id.slice(0, 8));
        }
      }
      participants = detail.participants.map((p) => {
        const sid = String(p.student_profile_id ?? "");
        return {
          id: String(p.id),
          studentProfileId: sid,
          fullName: nameById.get(sid) ?? sid.slice(0, 8),
          attendanceStatus: p.attendance_status
            ? String(p.attendance_status)
            : null,
          positionLabel: p.position_label ? String(p.position_label) : null,
          awardLabel: p.award_label ? String(p.award_label) : null,
          remarks: p.remarks ? String(p.remarks) : null,
        };
      });
    }
  }

  const sections = await listTeacherSections(
    supabase,
    authzCtx.schoolId,
    employmentId,
  );
  const studentMap = new Map<string, string>();
  for (const section of sections.slice(0, 8)) {
    const roster = await loadSectionRosterWithNames(supabase, section.id);
    for (const s of roster) {
      studentMap.set(s.studentProfileId, s.fullName);
    }
  }
  const students = [...studentMap.entries()].map(([studentProfileId, fullName]) => ({
    studentProfileId,
    fullName,
  }));

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Events
        </h1>
        <p className="mt-2 text-sm text-muted">
          School activities. Coordinators record attendance, placements, and
          achievements (feeds E35).
        </p>
      </header>
      <TeacherEventsClient
        employmentId={employmentId}
        events={events}
        selectedEventId={selectedEventId}
        canWrite={canWrite}
        students={students}
        participants={participants}
      />
    </>
  );
}
