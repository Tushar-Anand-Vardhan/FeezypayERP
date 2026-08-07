import type { createClient } from "@/lib/supabase/server";
import type { RecipientTarget } from "@/lib/notifications/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ResolvedRecipient = RecipientTarget & { key: string };

async function enrichAuthUserIds(
  supabase: Supabase,
  recipients: ResolvedRecipient[],
): Promise<ResolvedRecipient[]> {
  const personIds = [
    ...new Set(
      recipients
        .map((r) => r.personId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (personIds.length === 0) {
    return recipients;
  }

  const { data: persons } = await supabase
    .from("persons")
    .select("id, auth_user_id")
    .in("id", personIds);

  const authByPerson = new Map(
    (persons ?? [])
      .filter((p) => p.auth_user_id)
      .map((p) => [p.id, p.auth_user_id as string]),
  );

  return recipients.map((r) => ({
    ...r,
    authUserId: r.authUserId ?? (r.personId ? authByPerson.get(r.personId) : null),
  }));
}

export async function resolveParentsForStudent(
  supabase: Supabase,
  studentProfileId: string,
): Promise<ResolvedRecipient[]> {
  const { data: links } = await supabase
    .from("student_parent_links")
    .select("id, parent_profile_id, parent_profiles(person_id)")
    .eq("student_profile_id", studentProfileId);

  const out: ResolvedRecipient[] = [];
  for (const link of links ?? []) {
    const parentRel = link.parent_profiles as
      | { person_id?: string }
      | { person_id?: string }[]
      | null;
    const personId = Array.isArray(parentRel)
      ? parentRel[0]?.person_id
      : parentRel?.person_id;
    out.push({
      key: `par:${link.parent_profile_id}`,
      parentProfileId: link.parent_profile_id,
      personId: personId ?? null,
      studentProfileId,
    });
  }
  return enrichAuthUserIds(supabase, out);
}

export async function resolveStudentsInSection(
  supabase: Supabase,
  schoolId: string,
  sectionId: string,
  academicYearId?: string | null,
): Promise<ResolvedRecipient[]> {
  let query = supabase
    .from("student_academic_years")
    .select(
      "student_profile_id, status, student_admissions!inner(school_id, student_profiles(person_id))",
    )
    .eq("section_id", sectionId)
    .eq("status", "active")
    .eq("student_admissions.school_id", schoolId);

  if (academicYearId) {
    query = query.eq("academic_year_id", academicYearId);
  }

  const { data } = await query;
  const out: ResolvedRecipient[] = [];
  for (const row of data ?? []) {
    const adm = row.student_admissions as
      | {
          student_profiles?:
            | { person_id?: string }
            | { person_id?: string }[]
            | null;
        }
      | {
          student_profiles?:
            | { person_id?: string }
            | { person_id?: string }[]
            | null;
        }[]
      | null;
    const admRow = Array.isArray(adm) ? adm[0] : adm;
    const profileRel = admRow?.student_profiles;
    const personId = Array.isArray(profileRel)
      ? profileRel[0]?.person_id
      : profileRel?.person_id;
    out.push({
      key: `stu:${row.student_profile_id}`,
      studentProfileId: row.student_profile_id,
      personId: personId ?? null,
    });
  }
  return enrichAuthUserIds(supabase, out);
}

export async function resolveParentsForStudents(
  supabase: Supabase,
  studentProfileIds: string[],
): Promise<ResolvedRecipient[]> {
  const all: ResolvedRecipient[] = [];
  for (const id of studentProfileIds) {
    all.push(...(await resolveParentsForStudent(supabase, id)));
  }
  const seen = new Set<string>();
  return all.filter((r) => {
    if (seen.has(r.key)) return false;
    seen.add(r.key);
    return true;
  });
}

export async function resolveSchoolAdmins(
  supabase: Supabase,
  schoolId: string,
): Promise<ResolvedRecipient[]> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("school_id", schoolId)
    .eq("role", "school_admin");

  return (profiles ?? []).map((p) => ({
    key: `adm:${p.id}`,
    authUserId: p.id,
  }));
}

export async function resolveStudentSelf(
  supabase: Supabase,
  studentProfileId: string,
): Promise<ResolvedRecipient[]> {
  const { data } = await supabase
    .from("student_profiles")
    .select("id, person_id")
    .eq("id", studentProfileId)
    .maybeSingle();
  if (!data) return [];
  return enrichAuthUserIds(supabase, [
    {
      key: `stu:${data.id}`,
      studentProfileId: data.id,
      personId: data.person_id,
    },
  ]);
}
