import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function writeHomeworkAudit(
  supabase: Supabase,
  input: {
    schoolId: string;
    action: string;
    actorId?: string | null;
    homeworkId?: string | null;
    submissionId?: string | null;
    studentProfileId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  },
): Promise<void> {
  await supabase.from("homework_audit_log").insert({
    school_id: input.schoolId,
    action: input.action,
    actor_id: input.actorId ?? null,
    homework_id: input.homeworkId ?? null,
    submission_id: input.submissionId ?? null,
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

export async function assertSectionOwned(
  supabase: Supabase,
  schoolId: string,
  sectionId: string,
): Promise<{ ok: true; classId: string } | { ok: false }> {
  const { data: section } = await supabase
    .from("sections")
    .select("id, class_id")
    .eq("id", sectionId)
    .maybeSingle();
  if (!section) return { ok: false };

  const { data: klass } = await supabase
    .from("classes")
    .select("id, school_id")
    .eq("id", section.class_id)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!klass) return { ok: false };
  return { ok: true, classId: section.class_id as string };
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

export async function loadHomework(
  supabase: Supabase,
  schoolId: string,
  homeworkId: string,
) {
  const { data } = await supabase
    .from("homework_assignments")
    .select("*")
    .eq("id", homeworkId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return data;
}
