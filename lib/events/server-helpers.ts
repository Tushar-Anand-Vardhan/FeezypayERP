import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function writeEventAudit(
  supabase: Supabase,
  input: {
    schoolId: string;
    action: string;
    actorId?: string | null;
    calendarEventId?: string | null;
    eventParticipantId?: string | null;
    employmentId?: string | null;
    studentProfileId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  },
): Promise<void> {
  await supabase.from("event_activity_audit_log").insert({
    school_id: input.schoolId,
    action: input.action,
    actor_id: input.actorId ?? null,
    calendar_event_id: input.calendarEventId ?? null,
    event_participant_id: input.eventParticipantId ?? null,
    employment_id: input.employmentId ?? null,
    student_profile_id: input.studentProfileId ?? null,
    old_values: input.oldValues ?? null,
    new_values: input.newValues ?? null,
  });
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

export async function assertEventOwned(
  supabase: Supabase,
  schoolId: string,
  eventId: string,
): Promise<{
  ok: boolean;
  category?: string;
  title?: string;
  academicYearId?: string;
  certificateEnabled?: boolean;
  archivedAt?: string | null;
}> {
  const { data } = await supabase
    .from("calendar_events")
    .select(
      "id, category, title, academic_year_id, certificate_enabled, archived_at",
    )
    .eq("id", eventId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!data || data.archived_at) {
    return { ok: false };
  }
  return {
    ok: true,
    category: data.category,
    title: data.title,
    academicYearId: data.academic_year_id,
    certificateEnabled: data.certificate_enabled,
    archivedAt: data.archived_at,
  };
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

export async function assertEmploymentOwned(
  supabase: Supabase,
  schoolId: string,
  employmentId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("teacher_employments")
    .select("id")
    .eq("id", employmentId)
    .eq("school_id", schoolId)
    .eq("status", "active")
    .maybeSingle();
  return Boolean(data);
}

export async function assertHouseOwned(
  supabase: Supabase,
  schoolId: string,
  houseId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("houses")
    .select("id")
    .eq("id", houseId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertClubOwned(
  supabase: Supabase,
  schoolId: string,
  clubId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("clubs")
    .select("id")
    .eq("id", clubId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Keep competition_participations in sync for competition-category events.
 * Still references calendar_event_id — does not copy event body onto the student.
 */
export async function syncCompetitionProjection(
  supabase: Supabase,
  input: {
    schoolId: string;
    eventId: string;
    eventTitle: string;
    eventCategory: string;
    studentProfileId: string;
    eventParticipantId: string;
    role: string;
    positionLabel?: string | null;
    awardLabel?: string | null;
    participatedOn?: string | null;
  },
): Promise<void> {
  if (input.eventCategory !== "competition") {
    return;
  }

  const resultLabel =
    [input.positionLabel, input.awardLabel].filter(Boolean).join(" — ") ||
    null;

  const { data: existing } = await supabase
    .from("competition_participations")
    .select("id")
    .eq("calendar_event_id", input.eventId)
    .eq("student_profile_id", input.studentProfileId)
    .is("archived_at", null)
    .maybeSingle();

  const row = {
    school_id: input.schoolId,
    student_profile_id: input.studentProfileId,
    calendar_event_id: input.eventId,
    event_participant_id: input.eventParticipantId,
    title: input.eventTitle,
    role: input.role,
    result_label: resultLabel,
    position_label: input.positionLabel ?? null,
    award_label: input.awardLabel ?? null,
    participated_on: input.participatedOn ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase
      .from("competition_participations")
      .update(row)
      .eq("id", existing.id);
  } else {
    await supabase.from("competition_participations").insert(row);
  }
}
