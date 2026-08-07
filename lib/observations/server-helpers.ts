import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function writeObservationAudit(
  supabase: Supabase,
  input: {
    schoolId: string;
    action: string;
    actorId?: string | null;
    observationId?: string | null;
    categoryId?: string | null;
    studentProfileId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  },
): Promise<void> {
  await supabase.from("student_observation_audit_log").insert({
    school_id: input.schoolId,
    action: input.action,
    actor_id: input.actorId ?? null,
    observation_id: input.observationId ?? null,
    category_id: input.categoryId ?? null,
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

export async function assertTermInYear(
  supabase: Supabase,
  yearId: string,
  termId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("terms")
    .select("id")
    .eq("id", termId)
    .eq("academic_year_id", yearId)
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

export async function assertSubjectOwned(
  supabase: Supabase,
  schoolId: string,
  subjectId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
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
  studentAcademicYearId: string | null;
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

  const { data: placement } = await supabase
    .from("student_academic_years")
    .select("id, class_id, section_id")
    .eq("admission_id", admission.id)
    .eq("academic_year_id", academicYearId)
    .eq("status", "active")
    .is("left_on", null)
    .maybeSingle();

  if (!placement) {
    return {
      studentAcademicYearId: null,
      classId: null,
      sectionId: null,
    };
  }

  return {
    studentAcademicYearId: placement.id as string,
    classId: (placement.class_id as string | null) ?? null,
    sectionId: (placement.section_id as string | null) ?? null,
  };
}

export async function resolveCategory(
  supabase: Supabase,
  schoolId: string,
  input: { categoryId?: string; categoryCode?: string },
): Promise<{ id: string; code: string } | null> {
  if (input.categoryId) {
    const { data } = await supabase
      .from("student_observation_categories")
      .select("id, code")
      .eq("id", input.categoryId)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .maybeSingle();
    return data
      ? { id: data.id as string, code: data.code as string }
      : null;
  }
  if (input.categoryCode) {
    const { data } = await supabase
      .from("student_observation_categories")
      .select("id, code")
      .eq("school_id", schoolId)
      .eq("code", input.categoryCode.trim().toLowerCase())
      .is("archived_at", null)
      .maybeSingle();
    return data
      ? { id: data.id as string, code: data.code as string }
      : null;
  }
  return null;
}

export async function loadObservation(
  supabase: Supabase,
  schoolId: string,
  observationId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("student_observations")
    .select("*")
    .eq("id", observationId)
    .eq("school_id", schoolId)
    .maybeSingle();
  return data;
}
