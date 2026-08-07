import type { createClient } from "@/lib/supabase/server";
import type { TeacherWorkspaceEmployment } from "@/lib/teacher-workspace/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function listActiveEmployments(
  supabase: Supabase,
  schoolId: string,
): Promise<TeacherWorkspaceEmployment[]> {
  const { data: employments } = await supabase
    .from("teacher_employments")
    .select(
      "id, teacher_profile_id, designation, department_id, is_hod, status",
    )
    .eq("school_id", schoolId)
    .eq("status", "active")
    .order("joined_on", { ascending: false });

  if (!employments?.length) {
    return [];
  }

  const profileIds = employments.map((e) => e.teacher_profile_id);
  const { data: profiles } = await supabase
    .from("teacher_profiles")
    .select("id, person_id")
    .in("id", profileIds);

  const personIds = (profiles ?? []).map((p) => p.person_id);
  const { data: persons } = personIds.length
    ? await supabase
        .from("persons")
        .select("id, full_name")
        .in("id", personIds)
    : { data: [] as Array<{ id: string; full_name: string }> };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const personMap = new Map((persons ?? []).map((p) => [p.id, p]));

  return employments.map((e) => {
    const profile = profileMap.get(e.teacher_profile_id);
    const person = profile ? personMap.get(profile.person_id) : null;
    return {
      employmentId: e.id,
      teacherProfileId: e.teacher_profile_id,
      personId: profile?.person_id ?? "",
      fullName: person?.full_name ?? "",
      designation: e.designation,
      departmentId: e.department_id,
      isHod: e.is_hod,
      status: e.status,
    };
  });
}

export async function getEmploymentInSchool(
  supabase: Supabase,
  schoolId: string,
  employmentId: string,
): Promise<TeacherWorkspaceEmployment | null> {
  const list = await listActiveEmployments(supabase, schoolId);
  return list.find((e) => e.employmentId === employmentId) ?? null;
}

/** Prefer employment linked via persons.auth_user_id for future teacher login. */
export async function resolveEmploymentForAuthUser(
  supabase: Supabase,
  schoolId: string,
  authUserId: string,
): Promise<TeacherWorkspaceEmployment | null> {
  const { data: person } = await supabase
    .from("persons")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!person) {
    return null;
  }

  const { data: profile } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("person_id", person.id)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const { data: employment } = await supabase
    .from("teacher_employments")
    .select("id")
    .eq("school_id", schoolId)
    .eq("teacher_profile_id", profile.id)
    .eq("status", "active")
    .maybeSingle();

  if (!employment) {
    return null;
  }

  return getEmploymentInSchool(supabase, schoolId, employment.id);
}

export async function departmentIdsForEmployment(
  supabase: Supabase,
  employmentId: string,
  fallbackDepartmentId: string | null,
): Promise<string[]> {
  const { data: memberships } = await supabase
    .from("department_memberships")
    .select("department_id")
    .eq("employment_id", employmentId)
    .is("left_on", null);

  const ids = new Set((memberships ?? []).map((m) => m.department_id));
  if (fallbackDepartmentId) {
    ids.add(fallbackDepartmentId);
  }
  return [...ids];
}
