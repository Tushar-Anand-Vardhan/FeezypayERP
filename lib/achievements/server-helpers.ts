import type { createClient } from "@/lib/supabase/server";
import { visibilityFlags } from "@/lib/achievements/validation";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function writeAchievementAudit(
  supabase: Supabase,
  input: {
    schoolId: string;
    action: string;
    actorId?: string | null;
    achievementId?: string | null;
    studentProfileId?: string | null;
    calendarEventId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  },
): Promise<void> {
  await supabase.from("student_achievement_audit_log").insert({
    school_id: input.schoolId,
    action: input.action,
    actor_id: input.actorId ?? null,
    achievement_id: input.achievementId ?? null,
    student_profile_id: input.studentProfileId ?? null,
    calendar_event_id: input.calendarEventId ?? null,
    old_values: input.oldValues ?? null,
    new_values: input.newValues ?? null,
  });
}

export async function assertStudentInSchool(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("student_admissions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .maybeSingle();
  return Boolean(data);
}

export async function assertYearOwned(
  supabase: Supabase,
  schoolId: string,
  yearId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", yearId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function loadAchievement(
  supabase: Supabase,
  schoolId: string,
  achievementId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("student_achievements")
    .select("*")
    .eq("id", achievementId)
    .eq("school_id", schoolId)
    .maybeSingle();
  return data;
}

/**
 * Upsert permanent achievement projection from an E17 participant row.
 * Idempotent on event_participant_id. Does not copy event date/title SoT
 * beyond a display title snapshot.
 */
export async function upsertAchievementFromParticipant(
  supabase: Supabase,
  input: {
    schoolId: string;
    actorId?: string | null;
    eventParticipantId: string;
    points?: number | null;
    remarks?: string | null;
    visibility?: string;
    photoMediaIds?: string[];
    attachmentMediaIds?: string[];
    employmentId?: string | null;
  },
): Promise<{ id: string } | { error: string }> {
  const { data: participant } = await supabase
    .from("event_participants")
    .select(
      "id, school_id, calendar_event_id, student_profile_id, participation_role, attendance_status, award_label, position_label, certificate_status, certificate_document_id, remarks, attachment_media_ids, photo_media_ids, recorded_by_employment_id, archived_at",
    )
    .eq("id", input.eventParticipantId)
    .eq("school_id", input.schoolId)
    .maybeSingle();

  if (!participant || participant.archived_at) {
    return { error: "Event participant not found." };
  }

  const { data: event } = await supabase
    .from("calendar_events")
    .select("id, title, category, academic_year_id, term_id, starts_at")
    .eq("id", participant.calendar_event_id)
    .eq("school_id", input.schoolId)
    .maybeSingle();

  if (!event) {
    return { error: "Calendar event not found for participant." };
  }

  const visibility = input.visibility ?? "school";
  const vis = visibilityFlags(visibility);
  const awardedOn =
    typeof event.starts_at === "string"
      ? event.starts_at.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const category =
    event.category === "competition" ||
    event.category === "sports" ||
    event.category === "cultural" ||
    event.category === "club_activity" ||
    event.category === "house_activity"
      ? event.category === "club_activity"
        ? "club"
        : event.category === "house_activity"
          ? "house"
          : (event.category as string)
      : "other";

  const source =
    event.category === "competition" ? "competition" : "calendar_event";

  const payload = {
    school_id: input.schoolId,
    student_profile_id: participant.student_profile_id,
    academic_year_id: event.academic_year_id ?? null,
    term_id: event.term_id ?? null,
    title: event.title as string,
    category,
    awarded_on: awardedOn,
    description: null as string | null,
    source,
    calendar_event_id: event.id,
    event_participant_id: participant.id,
    participation_role: participant.participation_role,
    attendance_status: participant.attendance_status,
    award_label: participant.award_label,
    position_label: participant.position_label,
    certificate_status: participant.certificate_status ?? "none",
    certificate_document_id: participant.certificate_document_id ?? null,
    points: input.points ?? null,
    remarks: input.remarks ?? (participant.remarks as string | null) ?? null,
    photo_media_ids:
      input.photoMediaIds ??
      (participant.photo_media_ids as string[] | null) ??
      [],
    attachment_media_ids:
      input.attachmentMediaIds ??
      (participant.attachment_media_ids as string[] | null) ??
      [],
    evidence_media_ids:
      input.attachmentMediaIds ??
      (participant.attachment_media_ids as string[] | null) ??
      [],
    visibility,
    ...vis,
    recorded_by: input.actorId ?? null,
    recorded_by_employment_id:
      input.employmentId ??
      (participant.recorded_by_employment_id as string | null) ??
      null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("student_achievements")
    .select("id")
    .eq("event_participant_id", participant.id)
    .is("archived_at", null)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("student_achievements")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return { error: error?.message ?? "Failed to update achievement." };
    }
    return { id: data.id as string };
  }

  const { data, error } = await supabase
    .from("student_achievements")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create achievement." };
  }
  return { id: data.id as string };
}
