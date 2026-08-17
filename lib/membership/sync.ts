import type { SupabaseClient } from "@supabase/supabase-js";
import {
  staffPersonaFromEmployment,
  studentPersonaFromAdmission,
} from "@/lib/membership/validation";

type UpsertResult = { ok: true; id: string } | { ok: false; error: string };

export type MembershipUpsertRow = {
  person_id: string;
  school_id: string;
  membership_kind: string;
  status: string;
  effective_from?: string;
  effective_to?: string | null;
  school_persona: string;
  capability_class: string;
  source_type: string;
  source_id: string;
};

function toMembershipInsert(row: MembershipUpsertRow) {
  return {
    ...row,
    effective_from: row.effective_from ?? new Date().toISOString().slice(0, 10),
    effective_to: row.effective_to ?? null,
    archived_at: null,
    updated_at: new Date().toISOString(),
  };
}

async function upsertMembership(
  supabase: SupabaseClient,
  row: MembershipUpsertRow,
): Promise<UpsertResult> {
  const { data, error } = await supabase
    .from("school_memberships")
    .upsert(toMembershipInsert(row), { onConflict: "source_type,source_id" })
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data?.id) {
    return { ok: false, error: "Membership upsert returned no id." };
  }
  return { ok: true, id: data.id };
}

/** Bulk membership write — skips per-row SELECT. */
export async function upsertMemberships(
  supabase: SupabaseClient,
  rows: MembershipUpsertRow[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (rows.length === 0) {
    return { ok: true };
  }
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize).map(toMembershipInsert);
    const { error } = await supabase
      .from("school_memberships")
      .upsert(slice, { onConflict: "source_type,source_id" });
    if (error) {
      return { ok: false, error: error.message };
    }
  }
  return { ok: true };
}

export function staffMembershipPayload(input: {
  personId: string;
  schoolId: string;
  employmentId: string;
  status: string;
  joinedOn?: string | null;
  leftOn?: string | null;
  schoolPersona?: string | null;
  isHod?: boolean | null;
  employmentType?: string | null;
}): MembershipUpsertRow {
  const mapped = staffPersonaFromEmployment({
    schoolPersona: input.schoolPersona,
    isHod: input.isHod,
    employmentType: input.employmentType,
    status: input.status,
  });
  return {
    person_id: input.personId,
    school_id: input.schoolId,
    membership_kind: mapped.kind,
    status: mapped.status,
    effective_from: input.joinedOn ?? undefined,
    effective_to: input.leftOn ?? null,
    school_persona: mapped.persona,
    capability_class: "teacher",
    source_type: "employment",
    source_id: input.employmentId,
  };
}

export function studentMembershipPayload(input: {
  personId: string;
  schoolId: string;
  admissionId: string;
  status: string;
  admittedOn?: string | null;
  exitedOn?: string | null;
}): MembershipUpsertRow {
  const mapped = studentPersonaFromAdmission(input.status);
  return {
    person_id: input.personId,
    school_id: input.schoolId,
    membership_kind: mapped.kind,
    status: mapped.membershipStatus,
    effective_from: input.admittedOn ?? undefined,
    effective_to: input.exitedOn ?? null,
    school_persona: mapped.persona,
    capability_class: "student",
    source_type: "admission",
    source_id: input.admissionId,
  };
}

export function parentMembershipPayload(input: {
  personId: string;
  schoolId: string;
  parentLinkId: string;
  admissionStatus: string;
  admittedOn?: string | null;
}): MembershipUpsertRow {
  const status =
    input.admissionStatus === "withdrawn" ? "ended" : ("active" as const);
  return {
    person_id: input.personId,
    school_id: input.schoolId,
    membership_kind: "parent",
    status,
    effective_from: input.admittedOn ?? undefined,
    school_persona: "parent",
    capability_class: "parent",
    source_type: "parent_link",
    source_id: input.parentLinkId,
  };
}

export async function syncAdminMembership(
  supabase: SupabaseClient,
  input: { authUserId: string; schoolId: string; profileId: string },
): Promise<UpsertResult> {
  let { data: person } = await supabase
    .from("persons")
    .select("id")
    .eq("auth_user_id", input.authUserId)
    .maybeSingle();

  if (!person?.id) {
    const { data: authUser } = await supabase.auth.getUser();
    const email = authUser.user?.email ?? null;
    const { data: created, error } = await supabase
      .from("persons")
      .insert({
        full_name: email?.split("@")[0] ?? "School Admin",
        email,
        auth_user_id: input.authUserId,
        profile_completed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (error || !created?.id) {
      return {
        ok: false,
        error: error?.message ?? "Could not create admin person.",
      };
    }
    person = created;
  }

  return upsertMembership(supabase, {
    person_id: person.id,
    school_id: input.schoolId,
    membership_kind: "school_admin",
    status: "active",
    school_persona: "school_admin",
    capability_class: "admin",
    source_type: "profile",
    source_id: input.profileId,
  });
}

export async function syncStaffMembership(
  supabase: SupabaseClient,
  employmentId: string,
): Promise<UpsertResult> {
  const { data: te, error } = await supabase
    .from("teacher_employments")
    .select(
      "id, school_id, status, joined_on, left_on, school_persona, is_hod, employment_type, teacher_profiles(person_id)",
    )
    .eq("id", employmentId)
    .maybeSingle();

  if (error || !te) {
    return { ok: false, error: error?.message ?? "Employment not found." };
  }

  const profileRel = te.teacher_profiles as
    | { person_id?: string }
    | { person_id?: string }[]
    | null;
  const personId = Array.isArray(profileRel)
    ? profileRel[0]?.person_id
    : profileRel?.person_id;
  if (!personId) {
    return { ok: false, error: "Employment has no person." };
  }

  const mapped = staffPersonaFromEmployment({
    schoolPersona: te.school_persona,
    isHod: te.is_hod,
    employmentType: te.employment_type,
    status: te.status,
  });

  return upsertMembership(supabase, {
    person_id: personId,
    school_id: te.school_id,
    membership_kind: mapped.kind,
    status: mapped.status,
    effective_from: te.joined_on ?? undefined,
    effective_to: te.left_on,
    school_persona: mapped.persona,
    capability_class: "teacher",
    source_type: "employment",
    source_id: te.id,
  });
}

export async function syncStudentMembership(
  supabase: SupabaseClient,
  admissionId: string,
): Promise<UpsertResult> {
  const { data: sa, error } = await supabase
    .from("student_admissions")
    .select(
      "id, school_id, status, admitted_on, exited_on, student_profiles(person_id)",
    )
    .eq("id", admissionId)
    .maybeSingle();

  if (error || !sa) {
    return { ok: false, error: error?.message ?? "Admission not found." };
  }

  const profileRel = sa.student_profiles as
    | { person_id?: string }
    | { person_id?: string }[]
    | null;
  const personId = Array.isArray(profileRel)
    ? profileRel[0]?.person_id
    : profileRel?.person_id;
  if (!personId) {
    return { ok: false, error: "Admission has no person." };
  }

  const mapped = studentPersonaFromAdmission(sa.status);

  return upsertMembership(supabase, {
    person_id: personId,
    school_id: sa.school_id,
    membership_kind: mapped.kind,
    status: mapped.membershipStatus,
    effective_from: sa.admitted_on ?? undefined,
    effective_to: sa.exited_on,
    school_persona: mapped.persona,
    capability_class: "student",
    source_type: "admission",
    source_id: sa.id,
  });
}

export async function syncParentMembership(
  supabase: SupabaseClient,
  parentLinkId: string,
): Promise<UpsertResult> {
  const { data: link, error } = await supabase
    .from("student_parent_links")
    .select(
      "id, parent_profile_id, student_profile_id, parent_profiles(person_id)",
    )
    .eq("id", parentLinkId)
    .maybeSingle();

  if (error || !link) {
    return { ok: false, error: error?.message ?? "Parent link not found." };
  }

  const parentRel = link.parent_profiles as
    | { person_id?: string }
    | { person_id?: string }[]
    | null;
  const personId = Array.isArray(parentRel)
    ? parentRel[0]?.person_id
    : parentRel?.person_id;
  if (!personId) {
    return { ok: false, error: "Parent link has no person." };
  }

  const { data: admission } = await supabase
    .from("student_admissions")
    .select("id, school_id, status, admitted_on")
    .eq("student_profile_id", link.student_profile_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!admission) {
    return { ok: false, error: "No admission for child." };
  }

  const status =
    admission.status === "withdrawn" ? "ended" : ("active" as const);

  return upsertMembership(supabase, {
    person_id: personId,
    school_id: admission.school_id,
    membership_kind: "parent",
    status,
    effective_from: admission.admitted_on ?? undefined,
    school_persona: "parent",
    capability_class: "parent",
    source_type: "parent_link",
    source_id: link.id,
  });
}
