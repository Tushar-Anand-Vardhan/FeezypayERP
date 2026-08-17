/** D15 — cannot create/invite employment while active (or invited) elsewhere. */

type Supabase = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

export const D15_ACTIVE_EMPLOYMENT_MESSAGE =
  "This teacher already has an active or invited affiliation at another school. Ask them to leave that school (end employment) or update their profile before inviting them here.";

export async function findOtherActiveEmployment(
  supabase: Supabase,
  teacherProfileId: string,
  exceptSchoolId: string,
): Promise<{ employmentId: string; schoolId: string; status: string } | null> {
  const { data } = await supabase
    .from("teacher_employments")
    .select("id, school_id, status")
    .eq("teacher_profile_id", teacherProfileId)
    .in("status", ["active", "invited"])
    .neq("school_id", exceptSchoolId)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    employmentId: data.id,
    schoolId: data.school_id,
    status: data.status,
  };
}

export async function assertNoOtherActiveEmployment(
  supabase: Supabase,
  teacherProfileId: string,
  exceptSchoolId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const other = await findOtherActiveEmployment(
    supabase,
    teacherProfileId,
    exceptSchoolId,
  );
  if (other) {
    return { ok: false, error: D15_ACTIVE_EMPLOYMENT_MESSAGE };
  }
  return { ok: true };
}

/** Profiles that already have an active/invited employment at another school. */
export async function findProfilesWithOtherActiveEmployment(
  supabase: Supabase,
  teacherProfileIds: string[],
  exceptSchoolId: string,
): Promise<Set<string>> {
  const hits = new Set<string>();
  const unique = Array.from(new Set(teacherProfileIds.filter(Boolean)));
  const chunkSize = 80;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const slice = unique.slice(i, i + chunkSize);
    const { data } = await supabase
      .from("teacher_employments")
      .select("teacher_profile_id")
      .in("teacher_profile_id", slice)
      .in("status", ["active", "invited"])
      .neq("school_id", exceptSchoolId);
    for (const row of data ?? []) {
      if (row.teacher_profile_id) {
        hits.add(row.teacher_profile_id);
      }
    }
  }
  return hits;
}
