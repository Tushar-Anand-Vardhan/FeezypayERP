/** D14 — at most one active admission per student profile across schools. */

type Supabase = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

export const D14_ACTIVE_ADMISSION_MESSAGE =
  "This student already has an active admission at another school. Withdraw or transfer them there before admitting here.";

export async function findOtherActiveAdmission(
  supabase: Supabase,
  studentProfileId: string,
  exceptSchoolId: string,
): Promise<{ admissionId: string; schoolId: string } | null> {
  const { data } = await supabase
    .from("student_admissions")
    .select("id, school_id")
    .eq("student_profile_id", studentProfileId)
    .eq("status", "active")
    .neq("school_id", exceptSchoolId)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { admissionId: data.id, schoolId: data.school_id };
}

export async function assertNoOtherActiveAdmission(
  supabase: Supabase,
  studentProfileId: string,
  exceptSchoolId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const other = await findOtherActiveAdmission(
    supabase,
    studentProfileId,
    exceptSchoolId,
  );
  if (other) {
    return { ok: false, error: D14_ACTIVE_ADMISSION_MESSAGE };
  }
  return { ok: true };
}

/** Profiles that already have an active admission at another school. */
export async function findProfilesWithOtherActiveAdmission(
  supabase: Supabase,
  studentProfileIds: string[],
  exceptSchoolId: string,
): Promise<Set<string>> {
  const hits = new Set<string>();
  const unique = Array.from(new Set(studentProfileIds.filter(Boolean)));
  const chunkSize = 80;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const slice = unique.slice(i, i + chunkSize);
    const { data } = await supabase
      .from("student_admissions")
      .select("student_profile_id")
      .in("student_profile_id", slice)
      .eq("status", "active")
      .neq("school_id", exceptSchoolId);
    for (const row of data ?? []) {
      if (row.student_profile_id) {
        hits.add(row.student_profile_id);
      }
    }
  }
  return hits;
}
