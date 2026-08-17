"use server";

import { revalidatePath } from "next/cache";
import { createInvitesForSchoolBulk } from "@/lib/auth/create-invite";
import { hashAadhaar } from "@/lib/identity/aadhaar";
import {
  staffMembershipPayload,
  upsertMemberships,
} from "@/lib/membership/sync";
import { getActiveYearClassesForSchool } from "@/lib/onboarding/school-classes-server";
import {
  mapPool,
  ONBOARDING_ROW_CONCURRENCY,
} from "@/lib/onboarding/parallel";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import {
  clearMaskedStaffAadhaar,
  staffListsEquivalent,
  staffRowIdentityKey,
  trimStaffRows,
  validateStaffRows,
  type StaffFormRow,
} from "@/lib/onboarding/staff";
import {
  D15_ACTIVE_EMPLOYMENT_MESSAGE,
  findProfilesWithOtherActiveEmployment,
} from "@/lib/workforce/employment-guards";

type Result =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type StaffStepData =
  | {
      success: true;
      blocked: false;
      subjects: Array<{ id: string; name: string }>;
      departments: Array<{ id: string; name: string }>;
      teachers: Array<StaffFormRow & { id: string }>;
    }
  | { success: true; blocked: true }
  | { success: false; error: string };

type PersonHit = {
  id: string;
  email: string | null;
  aadhaar_hash: string | null;
};

async function resolvePersonAndTeacherProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  row: StaffFormRow,
): Promise<
  | { personId: string; teacherProfileId: string }
  | { error: string }
> {
  const aadhaar = row.aadhaar ? hashAadhaar(row.aadhaar) : null;

  const { data: matches, error: lookupError } = await supabase.rpc(
    "find_person_by_identity",
    {
      p_email: row.email || null,
      p_aadhaar_hash: aadhaar?.hash ?? null,
    },
  );

  if (lookupError) {
    return { error: lookupError.message };
  }

  const hit = (Array.isArray(matches) ? matches[0] : matches) as
    | PersonHit
    | undefined;

  if (hit) {
    if (
      aadhaar &&
      hit.aadhaar_hash &&
      hit.aadhaar_hash !== aadhaar.hash
    ) {
      return {
        error: `Email ${row.email} is already linked to a different Aadhaar.`,
      };
    }
    if (
      row.email &&
      hit.email &&
      hit.email.toLowerCase() !== row.email.toLowerCase() &&
      aadhaar &&
      hit.aadhaar_hash === aadhaar.hash
    ) {
      return {
        error: `Aadhaar is already linked to a different email (${hit.email}).`,
      };
    }

    const { data: profiles } = await supabase.rpc(
      "get_teacher_profile_for_person",
      { p_person_id: hit.id },
    );
    const profile = Array.isArray(profiles) ? profiles[0] : profiles;

    if (profile?.id) {
      await supabase.rpc("update_person_record", {
        p_person_id: hit.id,
        p_full_name: row.fullName,
        p_phone: row.phone || null,
        p_email: row.email || hit.email,
        p_aadhaar_hash: aadhaar?.hash ?? null,
        p_aadhaar_last4: aadhaar?.last4 ?? null,
      });

      return { personId: hit.id, teacherProfileId: profile.id };
    }

    const { data: createdProfileId, error: profileError } = await supabase.rpc(
      "create_teacher_profile_record",
      { p_person_id: hit.id },
    );

    if (profileError || !createdProfileId) {
      return {
        error: profileError?.message ?? "Could not create teacher profile.",
      };
    }

    return { personId: hit.id, teacherProfileId: createdProfileId as string };
  }

  const { data: personId, error: personError } = await supabase.rpc(
    "create_person_record",
    {
      p_full_name: row.fullName,
      p_email: row.email || null,
      p_phone: row.phone || null,
      p_aadhaar_hash: aadhaar?.hash ?? null,
      p_aadhaar_last4: aadhaar?.last4 ?? null,
    },
  );

  if (personError || !personId) {
    if (personError?.code === "23505") {
      return {
        error:
          "A person with this email or Aadhaar already exists but could not be matched cleanly. Check for conflicts.",
      };
    }
    return { error: personError?.message ?? "Could not create person." };
  }

  const { data: profileId, error: profileError } = await supabase.rpc(
    "create_teacher_profile_record",
    { p_person_id: personId },
  );

  if (profileError || !profileId) {
    return {
      error: profileError?.message ?? "Could not create teacher profile.",
    };
  }

  return { personId: personId as string, teacherProfileId: profileId as string };
}

export async function getStaffStepDataAction(): Promise<StaffStepData> {
  const context = await getAuthenticatedSchoolContext("onboarding.wizard.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const classesResult = await getActiveYearClassesForSchool(supabase, schoolId);
  if ("blocked" in classesResult) {
    return { success: true, blocked: true };
  }
  if ("error" in classesResult) {
    return { success: false, error: classesResult.error };
  }

  const [{ data: subjects }, { data: departments }, { data: employments }] =
    await Promise.all([
      supabase
        .from("subjects")
        .select("id, name")
        .eq("school_id", schoolId)
        .is("archived_at", null)
        .order("name"),
      supabase
        .from("departments")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name"),
      supabase
        .from("teacher_employments")
        .select(
          "id, employee_code, designation, is_hod, department_id, teacher_profiles(person_id, persons(full_name, phone, email, aadhaar_last4)), employment_subjects(subject_id, subjects(name))",
        )
        .eq("school_id", schoolId)
        .in("status", ["active", "invited"])
        .order("created_at", { ascending: true }),
    ]);

  if ((subjects ?? []).length === 0) {
    return { success: true, blocked: true };
  }

  const departmentById = new Map(
    (departments ?? []).map((row) => [row.id, row.name]),
  );

  return {
    success: true,
    blocked: false,
    subjects: subjects ?? [],
    departments: departments ?? [],
    teachers: (employments ?? []).map((employment) =>
      mapEmploymentToStaffRow(employment, departmentById),
    ),
  };
}

export async function saveStaffAction(formData: FormData): Promise<Result> {
  const context = await getAuthenticatedSchoolContext("onboarding.wizard.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const intent = String(formData.get("intent") ?? "save");

  let rows: StaffFormRow[] = [];
  try {
    rows = JSON.parse(String(formData.get("teachers") ?? "[]")) as StaffFormRow[];
  } catch {
    return { success: false, error: "Could not read teacher data." };
  }

  rows = clearMaskedStaffAadhaar(rows);

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("school_id", schoolId)
    .is("archived_at", null);

  const subjectByName = new Map(
    (subjects ?? []).map((row) => [row.name.toLowerCase(), row.id]),
  );

  const fieldErrors = validateStaffRows(
    rows,
    (subjects ?? []).map((row) => row.name),
    { requireAtLeastOne: intent === "next" },
  );
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const trimmed = trimStaffRows(rows);

  if (intent === "save" && trimmed.length === 0) {
    const { count } = await supabase
      .from("teacher_employments")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .in("status", ["active", "invited"]);
    if ((count ?? 0) > 0) {
      return {
        success: false,
        error:
          "Saving an empty staff list would end all active employments. Add at least one teacher, or keep existing rows.",
      };
    }
  }

  const [{ data: existingDepartments }, { data: existingEmployments }] =
    await Promise.all([
      supabase.from("departments").select("id, name").eq("school_id", schoolId),
      supabase
        .from("teacher_employments")
        .select(
          "id, teacher_profile_id, status, joined_on, employee_code, designation, is_hod, department_id, school_persona, employment_type, teacher_profiles(person_id, persons(full_name, phone, email, aadhaar_last4)), employment_subjects(subject_id, subjects(name))",
        )
        .eq("school_id", schoolId)
        .in("status", ["active", "invited"]),
    ]);

  const departmentIdByName = new Map(
    (existingDepartments ?? []).map((row) => [row.name.toLowerCase(), row.id]),
  );
  const departmentById = new Map(
    (existingDepartments ?? []).map((row) => [row.id, row.name]),
  );

  const existingTeacherRows = (existingEmployments ?? []).map((employment) =>
    mapEmploymentToStaffRow(employment, departmentById),
  );

  if (staffListsEquivalent(trimmed, existingTeacherRows)) {
    return {
      success: true,
      message: "Staff unchanged — nothing to save.",
    };
  }

  const existingByIdentity = new Map(
    existingTeacherRows.map((row) => [staffRowIdentityKey(row), row] as const),
  );

  const missingDepartments = Array.from(
    new Set(trimmed.map((row) => row.departmentName).filter(Boolean)),
  ).filter((name) => !departmentIdByName.has(name.toLowerCase()));

  if (missingDepartments.length > 0) {
    const { data: inserted, error } = await supabase
      .from("departments")
      .insert(
        missingDepartments.map((name) => ({ school_id: schoolId, name })),
      )
      .select("id, name");
    if (error || !inserted) {
      return {
        success: false,
        error: error?.message ?? "Could not create department.",
      };
    }
    for (const row of inserted) {
      departmentIdByName.set(row.name.toLowerCase(), row.id);
    }
  }

  const employmentByProfileId = new Map(
    (existingEmployments ?? []).map((row) => [row.teacher_profile_id, row]),
  );
  const personIdByProfile = new Map<string, string>();
  for (const employment of existingEmployments ?? []) {
    const profile = employment.teacher_profiles as
      | { person_id?: string }
      | { person_id?: string }[]
      | null;
    const resolved = Array.isArray(profile) ? profile[0] : profile;
    if (resolved?.person_id) {
      personIdByProfile.set(employment.teacher_profile_id, resolved.person_id);
    }
  }

  const keepEmploymentIds = new Set<string>();
  const dirty: StaffFormRow[] = [];
  for (const row of trimmed) {
    const prior = existingByIdentity.get(staffRowIdentityKey(row));
    if (prior && staffListsEquivalent([row], [prior])) {
      keepEmploymentIds.add(prior.id);
      continue;
    }
    dirty.push(row);
  }

  type ResolvedStaff = {
    row: StaffFormRow;
    personId: string;
    teacherProfileId: string;
  };

  const resolvedRows = await mapPool(
    dirty,
    ONBOARDING_ROW_CONCURRENCY,
    async (row): Promise<ResolvedStaff | { ok: false; error: string }> => {
      const resolved = await resolvePersonAndTeacherProfile(supabase, row);
      if ("error" in resolved) {
        return { ok: false, error: resolved.error };
      }
      return { ...resolved, row };
    },
  );

  const failedResolve = resolvedRows.find(
    (item): item is { ok: false; error: string } => "ok" in item && !item.ok,
  );
  if (failedResolve) {
    return { success: false, error: failedResolve.error };
  }
  const ready = resolvedRows.filter(
    (item): item is ResolvedStaff => !("ok" in item),
  );

  const newRows = ready.filter(
    (item) => !employmentByProfileId.has(item.teacherProfileId),
  );
  const blockedProfiles = await findProfilesWithOtherActiveEmployment(
    supabase,
    newRows.map((item) => item.teacherProfileId),
    schoolId,
  );
  if (blockedProfiles.size > 0) {
    const blocked = newRows.find((item) =>
      blockedProfiles.has(item.teacherProfileId),
    );
    return {
      success: false,
      error: `${blocked?.row.fullName ?? "A teacher"}: ${D15_ACTIVE_EMPLOYMENT_MESSAGE}`,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const memberships: ReturnType<typeof staffMembershipPayload>[] = [];
  const subjectEmploymentIdsToReset: string[] = [];
  const subjectLinks: Array<{ employment_id: string; subject_id: string }> = [];
  const invitesToSend: Array<{
    email: string;
    personId: string;
    employmentId: string;
    isHod: boolean;
  }> = [];

  const updateWave = ready.filter((item) =>
    employmentByProfileId.has(item.teacherProfileId),
  );
  const updateResults = await mapPool(
    updateWave,
    ONBOARDING_ROW_CONCURRENCY,
    async (item) => {
      const existing = employmentByProfileId.get(item.teacherProfileId)!;
      const schoolPersona = item.row.isHod ? "hod" : "teacher";
      const { error: updateError } = await supabase
        .from("teacher_employments")
        .update({
          employee_code: item.row.employeeCode || null,
          designation: item.row.designation || null,
          department_id: item.row.departmentName
            ? (departmentIdByName.get(item.row.departmentName.toLowerCase()) ??
              null)
            : null,
          is_hod: item.row.isHod,
          school_persona: schoolPersona,
          status: existing.status === "invited" ? "invited" : "active",
          left_on: null,
          updated_at: now,
        })
        .eq("id", existing.id);
      if (updateError) {
        return { ok: false as const, error: updateError.message };
      }
      return { ok: true as const, item, employmentId: existing.id, existing };
    },
  );
  const failedUpdate = updateResults.find((item) => !item.ok);
  if (failedUpdate && !failedUpdate.ok) {
    return { success: false, error: failedUpdate.error };
  }

  for (const result of updateResults) {
    if (!result.ok) continue;
    keepEmploymentIds.add(result.employmentId);
    subjectEmploymentIdsToReset.push(result.employmentId);
    memberships.push(
      staffMembershipPayload({
        personId: result.item.personId,
        schoolId,
        employmentId: result.employmentId,
        status:
          result.existing.status === "invited" ? "invited" : "active",
        joinedOn: result.existing.joined_on,
        leftOn: null,
        schoolPersona: result.item.row.isHod ? "hod" : "teacher",
        isHod: result.item.row.isHod,
      }),
    );
    pushSubjectLinks(
      result.item.row,
      result.employmentId,
      subjectByName,
      subjectLinks,
    );
  }

  if (newRows.length > 0) {
    const { data: inserted, error: employmentError } = await supabase
      .from("teacher_employments")
      .insert(
        newRows.map((item) => ({
          teacher_profile_id: item.teacherProfileId,
          school_id: schoolId,
          employee_code: item.row.employeeCode || null,
          designation: item.row.designation || null,
          department_id: item.row.departmentName
            ? (departmentIdByName.get(item.row.departmentName.toLowerCase()) ??
              null)
            : null,
          is_hod: item.row.isHod,
          school_persona: item.row.isHod ? "hod" : "teacher",
          status: item.row.email ? "invited" : "active",
          joined_on: today,
        })),
      )
      .select("id, teacher_profile_id");

    if (employmentError || !inserted) {
      return {
        success: false,
        error: employmentError?.message ?? "Could not save employment.",
      };
    }

    const employmentIdByProfile = new Map(
      inserted.map((row) => [row.teacher_profile_id, row.id]),
    );
    for (const item of newRows) {
      const employmentId = employmentIdByProfile.get(item.teacherProfileId);
      if (!employmentId) {
        return { success: false, error: "Could not save employment." };
      }
      keepEmploymentIds.add(employmentId);
      memberships.push(
        staffMembershipPayload({
          personId: item.personId,
          schoolId,
          employmentId,
          status: item.row.email ? "invited" : "active",
          joinedOn: today,
          leftOn: null,
          schoolPersona: item.row.isHod ? "hod" : "teacher",
          isHod: item.row.isHod,
        }),
      );
      pushSubjectLinks(item.row, employmentId, subjectByName, subjectLinks);
      if (item.row.email) {
        invitesToSend.push({
          email: item.row.email,
          personId: item.personId,
          employmentId,
          isHod: item.row.isHod,
        });
      }
    }
  }

  if (subjectEmploymentIdsToReset.length > 0) {
    await supabase
      .from("employment_subjects")
      .delete()
      .in("employment_id", subjectEmploymentIdsToReset);
  }
  if (subjectLinks.length > 0) {
    const { error: linkError } = await supabase
      .from("employment_subjects")
      .insert(subjectLinks);
    if (linkError) {
      return { success: false, error: linkError.message };
    }
  }

  const toEnd = (existingEmployments ?? []).filter(
    (row) => !keepEmploymentIds.has(row.id),
  );
  if (toEnd.length > 0) {
    await supabase
      .from("teacher_employments")
      .update({
        status: "ended",
        left_on: today,
        updated_at: now,
      })
      .in(
        "id",
        toEnd.map((row) => row.id),
      );

    for (const ended of toEnd) {
      const personId = personIdByProfile.get(ended.teacher_profile_id);
      if (!personId) continue;
      memberships.push(
        staffMembershipPayload({
          personId,
          schoolId,
          employmentId: ended.id,
          status: "ended",
          joinedOn: ended.joined_on,
          leftOn: today,
          schoolPersona: ended.school_persona,
          isHod: ended.is_hod,
          employmentType: ended.employment_type,
        }),
      );
    }
  }

  const membershipResult = await upsertMemberships(supabase, memberships);
  if (!membershipResult.ok) {
    return { success: false, error: membershipResult.error };
  }

  const actorId = context.actor?.authUserId;
  let inviteWarnings: string[] = [];
  if (invitesToSend.length > 0 && actorId) {
    const outcome = await createInvitesForSchoolBulk({
      supabase,
      schoolId,
      actorId,
      drafts: invitesToSend.map((invite) => ({
        email: invite.email,
        personId: invite.personId,
        targetPersona: invite.isHod ? "hod" : "teacher",
        employmentId: invite.employmentId,
      })),
    });
    inviteWarnings = outcome.warnings;
  } else if (invitesToSend.length > 0) {
    inviteWarnings.push("Could not send invites — missing actor id.");
  }

  revalidatePath("/onboarding", "layout");
  return {
    success: true,
    message:
      invitesToSend.length > 0
        ? inviteWarnings.length > 0
          ? `Staff saved. Invites processed with notes: ${inviteWarnings.join("; ")}`
          : "Staff saved. Auth invites were sent for new staff with email."
        : "Staff saved successfully.",
  };
}

function pushSubjectLinks(
  row: StaffFormRow,
  employmentId: string,
  subjectByName: Map<string, string>,
  subjectLinks: Array<{ employment_id: string; subject_id: string }>,
) {
  for (const name of row.subjectNames) {
    const subjectId = subjectByName.get(name.toLowerCase());
    if (subjectId) {
      subjectLinks.push({ employment_id: employmentId, subject_id: subjectId });
    }
  }
}

function mapEmploymentToStaffRow(
  employment: {
    id: string;
    is_hod: boolean;
    employee_code: string | null;
    designation: string | null;
    department_id: string | null;
    teacher_profiles: unknown;
    employment_subjects: unknown;
  },
  departmentById: Map<string, string>,
): StaffFormRow & { id: string } {
  const profile = employment.teacher_profiles as
    | {
        persons:
          | {
              full_name: string;
              phone: string | null;
              email: string | null;
              aadhaar_last4: string | null;
            }
          | {
              full_name: string;
              phone: string | null;
              email: string | null;
              aadhaar_last4: string | null;
            }[]
          | null;
      }
    | {
        persons:
          | {
              full_name: string;
              phone: string | null;
              email: string | null;
              aadhaar_last4: string | null;
            }
          | {
              full_name: string;
              phone: string | null;
              email: string | null;
              aadhaar_last4: string | null;
            }[]
          | null;
      }[]
    | null;

  const resolvedProfile = Array.isArray(profile) ? profile[0] : profile;
  const personRaw = resolvedProfile?.persons;
  const person = Array.isArray(personRaw) ? personRaw[0] : personRaw;
  const subjectLinks = Array.isArray(employment.employment_subjects)
    ? employment.employment_subjects
    : [];

  return {
    id: employment.id,
    fullName: person?.full_name ?? "",
    phone: person?.phone ?? "",
    email: person?.email ?? "",
    aadhaar: person?.aadhaar_last4 ? `********${person.aadhaar_last4}` : "",
    employeeCode: employment.employee_code ?? "",
    designation: employment.designation ?? "",
    departmentName: employment.department_id
      ? (departmentById.get(employment.department_id) ?? "")
      : "",
    subjectNames: subjectLinks
      .map((link) => {
        const typed = link as {
          subjects: { name: string } | { name: string }[] | null;
        };
        const subject = typed.subjects;
        if (Array.isArray(subject)) {
          return subject[0]?.name ?? "";
        }
        return subject?.name ?? "";
      })
      .filter(Boolean),
    isHod: employment.is_hod,
  };
}
