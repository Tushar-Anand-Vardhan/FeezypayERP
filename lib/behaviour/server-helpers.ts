import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function writeBehaviourAudit(
  supabase: Supabase,
  input: {
    schoolId: string;
    action: string;
    actorId?: string | null;
    conductIncidentId?: string | null;
    followUpId?: string | null;
    studentProfileId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  },
): Promise<void> {
  await supabase.from("behaviour_audit_log").insert({
    school_id: input.schoolId,
    action: input.action,
    actor_id: input.actorId ?? null,
    conduct_incident_id: input.conductIncidentId ?? null,
    follow_up_id: input.followUpId ?? null,
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

export async function resolvePlacement(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
  academicYearId: string,
): Promise<{
  studentAcademicYearId: string;
  classId: string | null;
  sectionId: string | null;
} | null> {
  const { data: admission } = await supabase
    .from("student_admissions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .maybeSingle();
  if (!admission) return null;

  const { data: say } = await supabase
    .from("student_academic_years")
    .select("id, class_id, section_id")
    .eq("admission_id", admission.id)
    .eq("academic_year_id", academicYearId)
    .eq("status", "active")
    .is("left_on", null)
    .maybeSingle();

  if (!say) return null;
  return {
    studentAcademicYearId: say.id,
    classId: say.class_id,
    sectionId: say.section_id,
  };
}

export async function loadIncident(
  supabase: Supabase,
  schoolId: string,
  incidentId: string,
) {
  const { data } = await supabase
    .from("conduct_incidents")
    .select("*")
    .eq("id", incidentId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .is("superseded_at", null)
    .maybeSingle();
  return data;
}
