"use server";

import { revalidatePath } from "next/cache";
import { createInvitesForSchoolBulk, type InviteDraft } from "@/lib/auth/create-invite";
import {
  D14_ACTIVE_ADMISSION_MESSAGE,
  findProfilesWithOtherActiveAdmission,
} from "@/lib/enrollment/admission-guards";
import { hashAadhaar } from "@/lib/identity/aadhaar";
import {
  parentMembershipPayload,
  studentMembershipPayload,
  upsertMemberships,
  type MembershipUpsertRow,
} from "@/lib/membership/sync";
import {
  chunkArray,
  mapPool,
  ONBOARDING_IN_CHUNK,
  ONBOARDING_ROW_CONCURRENCY,
} from "@/lib/onboarding/parallel";
import { getActiveYearClassesForSchool } from "@/lib/onboarding/school-classes-server";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import {
  resolveClassSectionPair,
  studentListsEquivalent,
  studentRowIdentityKey,
  trimStudentRows,
  validateStudentRows,
  type GuardianFormRow,
  type StudentFormRow,
} from "@/lib/onboarding/students";

type Result =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type StudentsStepData =
  | {
      success: true;
      blocked: false;
      classSections: Array<{
        classId: string;
        className: string;
        sectionId: string;
        sectionName: string;
      }>;
      students: StudentFormRow[];
    }
  | { success: true; blocked: true }
  | { success: false; error: string };

type PersonHit = {
  id: string;
  email: string | null;
  aadhaar_hash: string | null;
};

async function resolveStudentPerson(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  row: StudentFormRow,
): Promise<{ personId: string; studentProfileId: string } | { error: string }> {
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
    if (aadhaar && hit.aadhaar_hash && hit.aadhaar_hash !== aadhaar.hash) {
      return {
        error: `Identity conflict for ${row.fullName}: email/Aadhaar mismatch.`,
      };
    }

    const { data: profiles } = await supabase.rpc(
      "get_student_profile_for_person",
      { p_person_id: hit.id },
    );
    const profile = Array.isArray(profiles) ? profiles[0] : profiles;

    await supabase.rpc("update_person_record", {
      p_person_id: hit.id,
      p_full_name: row.fullName,
      p_date_of_birth: row.dateOfBirth || null,
      p_gender: row.gender || null,
      p_email: row.email || hit.email,
      p_aadhaar_hash: aadhaar?.hash ?? null,
      p_aadhaar_last4: aadhaar?.last4 ?? null,
    });

    if (profile?.id) {
      return { personId: hit.id, studentProfileId: profile.id };
    }

    const { data: createdId, error } = await supabase.rpc(
      "create_student_profile_record",
      { p_person_id: hit.id },
    );
    if (error || !createdId) {
      return { error: error?.message ?? "Could not create student profile." };
    }
    return { personId: hit.id, studentProfileId: createdId as string };
  }

  const { data: personId, error: personError } = await supabase.rpc(
    "create_person_record",
    {
      p_full_name: row.fullName,
      p_date_of_birth: row.dateOfBirth || null,
      p_gender: row.gender || null,
      p_email: row.email || null,
      p_aadhaar_hash: aadhaar?.hash ?? null,
      p_aadhaar_last4: aadhaar?.last4 ?? null,
    },
  );

  if (personError || !personId) {
    return { error: personError?.message ?? "Could not create person." };
  }

  const { data: profileId, error: profileError } = await supabase.rpc(
    "create_student_profile_record",
    { p_person_id: personId },
  );

  if (profileError || !profileId) {
    return {
      error: profileError?.message ?? "Could not create student profile.",
    };
  }

  return {
    personId: personId as string,
    studentProfileId: profileId as string,
  };
}

export async function getStudentsStepDataAction(): Promise<StudentsStepData> {
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

  const classIds = classesResult.classes.map((row) => row.id);
  const { data: sections } = await supabase
    .from("sections")
    .select("id, name, class_id")
    .in("class_id", classIds)
    .order("display_order");

  if (!sections || sections.length === 0) {
    return { success: true, blocked: true };
  }

  const classNameById = new Map(
    classesResult.classes.map((row) => [row.id, row.name]),
  );

  const classSections = sections.map((section) => ({
    classId: section.class_id,
    className: classNameById.get(section.class_id) ?? "",
    sectionId: section.id,
    sectionName: section.name,
  }));

  const { data: admissions } = await supabase
    .from("student_admissions")
    .select(
      "admission_number, student_profiles(id, persons(full_name, date_of_birth, gender, email, aadhaar_last4), student_parent_links(relationship, parent_profiles(persons(full_name, phone, email)))), student_academic_years(status, left_on, class_id, section_id)",
    )
    .eq("school_id", schoolId)
    .eq("status", "active")
    .order("admission_number");

  const sectionNameById = new Map(sections.map((row) => [row.id, row.name]));

  return {
    success: true,
    blocked: false,
    classSections,
    students: (admissions ?? []).map((admission) => {
      const profileRaw = admission.student_profiles as
        | {
            id: string;
            persons:
              | {
                  full_name: string;
                  date_of_birth: string | null;
                  gender: string | null;
                  email: string | null;
                  aadhaar_last4: string | null;
                }
              | {
                  full_name: string;
                  date_of_birth: string | null;
                  gender: string | null;
                  email: string | null;
                  aadhaar_last4: string | null;
                }[]
              | null;
            student_parent_links: unknown;
          }
        | {
            id: string;
            persons:
              | {
                  full_name: string;
                  date_of_birth: string | null;
                  gender: string | null;
                  email: string | null;
                  aadhaar_last4: string | null;
                }
              | {
                  full_name: string;
                  date_of_birth: string | null;
                  gender: string | null;
                  email: string | null;
                  aadhaar_last4: string | null;
                }[]
              | null;
            student_parent_links: unknown;
          }[]
        | null;

      const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
      const personRaw = profile?.persons;
      const person = Array.isArray(personRaw) ? personRaw[0] : personRaw;

      const years = Array.isArray(admission.student_academic_years)
        ? admission.student_academic_years
        : [];
      const active = years.find(
        (row) => row.status === "active" && !row.left_on,
      );

      const links = Array.isArray(profile?.student_parent_links)
        ? profile.student_parent_links
        : [];

      return {
        fullName: person?.full_name ?? "",
        dateOfBirth: person?.date_of_birth ?? "",
        gender: (person?.gender as "" | "male" | "female" | "other") ?? "",
        admissionNumber: admission.admission_number,
        aadhaar: person?.aadhaar_last4
          ? `********${person.aadhaar_last4}`
          : "",
        email: person?.email ?? "",
        className: active ? (classNameById.get(active.class_id) ?? "") : "",
        sectionName: active
          ? (sectionNameById.get(active.section_id) ?? "")
          : "",
        guardians: links.map((link) => {
          const typed = link as {
            relationship: string;
            parent_profiles:
              | {
                  persons:
                    | {
                        full_name: string;
                        phone: string | null;
                        email: string | null;
                      }
                    | {
                        full_name: string;
                        phone: string | null;
                        email: string | null;
                      }[]
                    | null;
                }
              | {
                  persons:
                    | {
                        full_name: string;
                        phone: string | null;
                        email: string | null;
                      }
                    | {
                        full_name: string;
                        phone: string | null;
                        email: string | null;
                      }[]
                    | null;
                }[]
              | null;
          };
          const parentProfile = Array.isArray(typed.parent_profiles)
            ? typed.parent_profiles[0]
            : typed.parent_profiles;
          const parentPersonRaw = parentProfile?.persons;
          const parentPerson = Array.isArray(parentPersonRaw)
            ? parentPersonRaw[0]
            : parentPersonRaw;

          return {
            fullName: parentPerson?.full_name ?? "",
            relationship: typed.relationship,
            phone: parentPerson?.phone ?? "",
            whatsappNumber: parentPerson?.phone ?? "",
            email: parentPerson?.email ?? "",
            whatsappOptIn: false,
          };
        }),
      };
    }),
  };
}

export async function saveStudentsAction(formData: FormData): Promise<Result> {
  const context = await getAuthenticatedSchoolContext("onboarding.wizard.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const intent = String(formData.get("intent") ?? "save");

  let rows: StudentFormRow[] = [];
  try {
    rows = JSON.parse(String(formData.get("students") ?? "[]")) as StudentFormRow[];
  } catch {
    return { success: false, error: "Could not read student data." };
  }

  rows = rows.map((row) => ({
    ...row,
    aadhaar: row.aadhaar?.includes("*") ? "" : (row.aadhaar ?? ""),
  }));

  const classesResult = await getActiveYearClassesForSchool(supabase, schoolId);
  if ("error" in classesResult) {
    return { success: false, error: classesResult.error };
  }
  if ("blocked" in classesResult) {
    return { success: false, error: "Complete Classes and Sections first." };
  }

  const classIds = classesResult.classes.map((row) => row.id);
  const { data: sections } = await supabase
    .from("sections")
    .select("id, name, class_id")
    .in("class_id", classIds);

  const classNameById = new Map(
    classesResult.classes.map((row) => [row.id, row.name]),
  );
  const classSectionPairs = (sections ?? []).map((section) => ({
    className: classNameById.get(section.class_id) ?? "",
    sectionName: section.name,
    classId: section.class_id,
    sectionId: section.id,
  }));

  const fieldErrors = validateStudentRows(
    rows,
    classSectionPairs.map((pair) => ({
      className: pair.className,
      sectionName: pair.sectionName,
    })),
    { requireAtLeastOne: intent === "next" },
  );
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const trimmed = trimStudentRows(rows);

  if (intent === "save" && trimmed.length === 0) {
    const { count } = await supabase
      .from("student_admissions")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active");
    if ((count ?? 0) > 0) {
      return {
        success: false,
        error:
          "Saving an empty student list would close all active admissions. Add at least one student, or keep existing rows.",
      };
    }
  }

  const sectionNameById = new Map(
    (sections ?? []).map((row) => [row.id, row.name]),
  );

  const { data: existingAdmissions } = await supabase
    .from("student_admissions")
    .select(
      "id, admission_number, student_profile_id, status, admitted_on, student_profiles(id, person_id, persons(full_name, date_of_birth, gender, email, aadhaar_last4), student_parent_links(relationship, parent_profiles(person_id, persons(full_name, phone, email)))), student_academic_years(status, left_on, class_id, section_id)",
    )
    .eq("school_id", schoolId);

  const existingStudentRows = (existingAdmissions ?? [])
    .filter((row) => row.status === "active")
    .map((admission) =>
      mapAdmissionToStudentRow(admission, classNameById, sectionNameById),
    );

  if (studentListsEquivalent(trimmed, existingStudentRows)) {
    return {
      success: true,
      message: "Students unchanged — nothing to save.",
    };
  }

  const existingByNumber = new Map(
    existingStudentRows.map((row) => [
      studentRowIdentityKey(row),
      row,
    ] as const),
  );
  const admissionByNumber = new Map(
    (existingAdmissions ?? []).map((row) => [
      row.admission_number.toLowerCase(),
      row,
    ]),
  );

  const keepAdmissionIds = new Set<string>();
  const dirty: StudentFormRow[] = [];
  for (const row of trimmed) {
    const prior = existingByNumber.get(studentRowIdentityKey(row));
    const existing = admissionByNumber.get(row.admissionNumber.toLowerCase());
    if (prior && existing && studentListsEquivalent([row], [prior])) {
      keepAdmissionIds.add(existing.id);
      continue;
    }
    dirty.push(row);
  }

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const academicYearId = classesResult.academicYear.id;

  type Pair = (typeof classSectionPairs)[number];
  type Prepared = {
    row: StudentFormRow;
    pair: Pair;
    personId: string;
    studentProfileId: string;
  };

  const prepared = await mapPool(
    dirty,
    ONBOARDING_ROW_CONCURRENCY,
    async (row): Promise<Prepared | { ok: false; error: string }> => {
      const resolvedPair = resolveClassSectionPair(
        row.className,
        row.sectionName,
        classSectionPairs,
      );
      const pair = resolvedPair
        ? classSectionPairs.find(
            (item) =>
              item.className === resolvedPair.className &&
              item.sectionName === resolvedPair.sectionName,
          )
        : undefined;
      if (!pair) {
        return {
          ok: false,
          error: `Could not resolve class/section "${row.className}" / "${row.sectionName}". Use a class/section from your setup (short class forms like "6" for "Class 6" are OK).`,
        };
      }
      const resolved = await resolveStudentPerson(supabase, row);
      if ("error" in resolved) {
        return { ok: false, error: resolved.error };
      }
      const existing = admissionByNumber.get(row.admissionNumber.toLowerCase());
      if (
        existing &&
        existing.student_profile_id !== resolved.studentProfileId
      ) {
        return {
          ok: false,
          error: `Admission number ${row.admissionNumber} is already linked to a different student.`,
        };
      }
      return { row, pair, ...resolved };
    },
  );

  const failedPrepare = prepared.find(
    (item): item is { ok: false; error: string } => "ok" in item && !item.ok,
  );
  if (failedPrepare) {
    return { success: false, error: failedPrepare.error };
  }
  const ready = prepared.filter(
    (item): item is Prepared => !("ok" in item),
  );

  const blockedProfiles = await findProfilesWithOtherActiveAdmission(
    supabase,
    ready.map((item) => item.studentProfileId),
    schoolId,
  );
  if (blockedProfiles.size > 0) {
    const blocked = ready.find((item) =>
      blockedProfiles.has(item.studentProfileId),
    );
    return {
      success: false,
      error: `${blocked?.row.fullName ?? "A student"} (${blocked?.row.admissionNumber ?? ""}): ${D14_ACTIVE_ADMISSION_MESSAGE}`,
    };
  }

  const updates = ready.filter((item) =>
    admissionByNumber.has(item.row.admissionNumber.toLowerCase()),
  );
  const creates = ready.filter(
    (item) => !admissionByNumber.has(item.row.admissionNumber.toLowerCase()),
  );

  const admissionIdByKey = new Map<string, string>();
  const personIdByAdmission = new Map<string, string>();
  const admittedOnByAdmission = new Map<string, string>();

  for (const existing of existingAdmissions ?? []) {
    if (existing.admitted_on) {
      admittedOnByAdmission.set(existing.id, existing.admitted_on);
    }
    const profile = existing.student_profiles as
      | { person_id?: string }
      | { person_id?: string }[]
      | null;
    const resolved = Array.isArray(profile) ? profile[0] : profile;
    if (resolved?.person_id) {
      personIdByAdmission.set(existing.id, resolved.person_id);
    }
  }

  const updateResults = await mapPool(
    updates,
    ONBOARDING_ROW_CONCURRENCY,
    async (item) => {
      const existing = admissionByNumber.get(
        item.row.admissionNumber.toLowerCase(),
      )!;
      const { error: updateError } = await supabase
        .from("student_admissions")
        .update({
          student_profile_id: item.studentProfileId,
          status: "active",
          exited_on: null,
          updated_at: now,
        })
        .eq("id", existing.id);
      if (updateError) {
        return { ok: false as const, error: updateError.message };
      }
      return { ok: true as const, item, admissionId: existing.id };
    },
  );
  const failedAdmissionUpdate = updateResults.find((item) => !item.ok);
  if (failedAdmissionUpdate && !failedAdmissionUpdate.ok) {
    return { success: false, error: failedAdmissionUpdate.error };
  }

  for (const result of updateResults) {
    if (!result.ok) continue;
    keepAdmissionIds.add(result.admissionId);
    admissionIdByKey.set(
      result.item.row.admissionNumber.toLowerCase(),
      result.admissionId,
    );
    personIdByAdmission.set(result.admissionId, result.item.personId);
  }

  if (creates.length > 0) {
    const { data: inserted, error: admissionError } = await supabase
      .from("student_admissions")
      .insert(
        creates.map((item) => ({
          student_profile_id: item.studentProfileId,
          school_id: schoolId,
          admission_number: item.row.admissionNumber,
          admitted_on: today,
          status: "active",
        })),
      )
      .select("id, admission_number");

    if (admissionError || !inserted) {
      return {
        success: false,
        error: admissionError?.message ?? "Could not save admission.",
      };
    }

    const byNumber = new Map(
      inserted.map((row) => [row.admission_number.toLowerCase(), row.id]),
    );
    for (const item of creates) {
      const admissionId = byNumber.get(item.row.admissionNumber.toLowerCase());
      if (!admissionId) {
        return { success: false, error: "Could not save admission." };
      }
      keepAdmissionIds.add(admissionId);
      admissionIdByKey.set(item.row.admissionNumber.toLowerCase(), admissionId);
      personIdByAdmission.set(admissionId, item.personId);
      admittedOnByAdmission.set(admissionId, today);
    }
  }

  const yearAdmissionIds = ready
    .map((item) =>
      admissionIdByKey.get(item.row.admissionNumber.toLowerCase()),
    )
    .filter((id): id is string => Boolean(id));

  const existingYearByAdmission = new Map<string, string>();
  if (yearAdmissionIds.length > 0) {
    for (const slice of chunkArray(yearAdmissionIds, ONBOARDING_IN_CHUNK)) {
      const { data: yearRows } = await supabase
        .from("student_academic_years")
        .select("id, admission_id")
        .eq("academic_year_id", academicYearId)
        .in("admission_id", slice);
      for (const year of yearRows ?? []) {
        existingYearByAdmission.set(year.admission_id, year.id);
      }
    }
  }

  const yearUpdates: Array<{
    id: string;
    classId: string;
    sectionId: string;
  }> = [];
  const yearInserts: Array<{
    admission_id: string;
    academic_year_id: string;
    class_id: string;
    section_id: string;
    enrolled_on: string;
    status: string;
    enrollment_type: string;
  }> = [];

  for (const item of ready) {
    const admissionId = admissionIdByKey.get(
      item.row.admissionNumber.toLowerCase(),
    );
    if (!admissionId) continue;
    const yearId = existingYearByAdmission.get(admissionId);
    if (yearId) {
      yearUpdates.push({
        id: yearId,
        classId: item.pair.classId,
        sectionId: item.pair.sectionId,
      });
    } else {
      yearInserts.push({
        admission_id: admissionId,
        academic_year_id: academicYearId,
        class_id: item.pair.classId,
        section_id: item.pair.sectionId,
        enrolled_on: today,
        status: "active",
        enrollment_type: "new_admission",
      });
    }
  }

  const yearUpdateResults = await mapPool(
    yearUpdates,
    ONBOARDING_ROW_CONCURRENCY,
    async (year) => {
      const { error } = await supabase
        .from("student_academic_years")
        .update({
          class_id: year.classId,
          section_id: year.sectionId,
          status: "active",
          left_on: null,
        })
        .eq("id", year.id);
      return error
        ? { ok: false as const, error: error.message }
        : { ok: true as const };
    },
  );
  const failedYearUpdate = yearUpdateResults.find((item) => !item.ok);
  if (failedYearUpdate && !failedYearUpdate.ok) {
    return { success: false, error: failedYearUpdate.error };
  }

  if (yearInserts.length > 0) {
    const { error: yearInsertError } = await supabase
      .from("student_academic_years")
      .insert(yearInserts);
    if (yearInsertError) {
      return { success: false, error: yearInsertError.message };
    }
  }

  const parentCache = new Map<
    string,
    Promise<{ personId: string; parentProfileId: string } | { error: string }>
  >();
  const parentResults = await mapPool(
    ready,
    ONBOARDING_ROW_CONCURRENCY,
    async (item) => {
      const guardian = item.row.guardians[0];
      if (!guardian?.fullName) {
        return { ok: true as const, item, parent: null };
      }
      const resolvedParent = await resolveParentPersonCached(
        supabase,
        guardian,
        parentCache,
      );
      if ("error" in resolvedParent) {
        return { ok: false as const, error: resolvedParent.error };
      }
      return { ok: true as const, item, parent: resolvedParent };
    },
  );
  const failedParent = parentResults.find((item) => !item.ok);
  if (failedParent && !failedParent.ok) {
    return { success: false, error: failedParent.error };
  }

  const parentLinks: Array<{
    student_profile_id: string;
    parent_profile_id: string;
    relationship: string;
    is_primary: boolean;
    admissionId: string;
    parentPersonId: string;
  }> = [];
  const inviteDrafts: InviteDraft[] = [];

  for (const result of parentResults) {
    if (!result.ok || !result.parent) continue;
    const admissionId = admissionIdByKey.get(
      result.item.row.admissionNumber.toLowerCase(),
    );
    if (!admissionId) continue;
    const guardian = result.item.row.guardians[0];
    parentLinks.push({
      student_profile_id: result.item.studentProfileId,
      parent_profile_id: result.parent.parentProfileId,
      relationship: guardian?.relationship || "parent",
      is_primary: true,
      admissionId,
      parentPersonId: result.parent.personId,
    });
    if (guardian?.email?.trim()) {
      inviteDrafts.push({
        email: guardian.email.trim(),
        personId: result.parent.personId,
        targetPersona: "parent",
        parentProfileId: result.parent.parentProfileId,
        admissionId,
      });
    }
  }

  const memberships: MembershipUpsertRow[] = [];
  for (const item of ready) {
    const admissionId = admissionIdByKey.get(
      item.row.admissionNumber.toLowerCase(),
    );
    if (!admissionId) continue;
    memberships.push(
      studentMembershipPayload({
        personId: item.personId,
        schoolId,
        admissionId,
        status: "active",
        admittedOn: admittedOnByAdmission.get(admissionId) ?? today,
        exitedOn: null,
      }),
    );
  }

  if (parentLinks.length > 0) {
    const { data: linkRows, error: linkError } = await supabase
      .from("student_parent_links")
      .upsert(
        parentLinks.map((link) => ({
          student_profile_id: link.student_profile_id,
          parent_profile_id: link.parent_profile_id,
          relationship: link.relationship,
          is_primary: link.is_primary,
        })),
        { onConflict: "student_profile_id,parent_profile_id" },
      )
      .select("id, student_profile_id, parent_profile_id");
    if (linkError) {
      return { success: false, error: linkError.message };
    }
    const linkIdByPair = new Map(
      (linkRows ?? []).map((row) => [
        `${row.student_profile_id}:${row.parent_profile_id}`,
        row.id,
      ]),
    );
    for (const link of parentLinks) {
      const linkId = linkIdByPair.get(
        `${link.student_profile_id}:${link.parent_profile_id}`,
      );
      if (!linkId) continue;
      memberships.push(
        parentMembershipPayload({
          personId: link.parentPersonId,
          schoolId,
          parentLinkId: linkId,
          admissionStatus: "active",
          admittedOn: admittedOnByAdmission.get(link.admissionId) ?? today,
        }),
      );
    }
  }

  const toEnd = (existingAdmissions ?? [])
    .filter((row) => row.status === "active" && !keepAdmissionIds.has(row.id))
    .map((row) => row.id);

  if (toEnd.length > 0) {
    await supabase
      .from("student_academic_years")
      .update({
        status: "withdrawn",
        left_on: today,
      })
      .in("admission_id", toEnd)
      .eq("status", "active");

    await supabase
      .from("student_admissions")
      .update({
        status: "withdrawn",
        exited_on: today,
        updated_at: now,
      })
      .in("id", toEnd);

    for (const endedId of toEnd) {
      const personId = personIdByAdmission.get(endedId);
      if (!personId) continue;
      memberships.push(
        studentMembershipPayload({
          personId,
          schoolId,
          admissionId: endedId,
          status: "withdrawn",
          admittedOn: admittedOnByAdmission.get(endedId),
          exitedOn: today,
        }),
      );
    }
  }

  const membershipResult = await upsertMemberships(supabase, memberships);
  if (!membershipResult.ok) {
    return { success: false, error: membershipResult.error };
  }

  const actorId = context.actor?.authUserId;
  if (inviteDrafts.length > 0 && actorId) {
    try {
      await createInvitesForSchoolBulk({
        supabase,
        schoolId,
        actorId,
        drafts: inviteDrafts,
      });
    } catch {
      // Parent invite is best-effort; admission save should not fail.
    }
  }

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "Students saved successfully." };
}

async function resolveParentPersonCached(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  guardian: GuardianFormRow,
  cache: Map<
    string,
    Promise<{ personId: string; parentProfileId: string } | { error: string }>
  >,
) {
  const email = guardian.email.trim().toLowerCase();
  const key = email ? `e:${email}` : "";
  if (key) {
    const existing = cache.get(key);
    if (existing) {
      return existing;
    }
    const pending = resolveParentPerson(supabase, guardian);
    cache.set(key, pending);
    return pending;
  }
  return resolveParentPerson(supabase, guardian);
}

async function resolveParentPerson(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  guardian: GuardianFormRow,
): Promise<{ personId: string; parentProfileId: string } | { error: string }> {
  const { data: parentMatches } = await supabase.rpc("find_person_by_identity", {
    p_email: guardian.email || null,
    p_aadhaar_hash: null,
  });
  const parentHit = (
    Array.isArray(parentMatches) ? parentMatches[0] : parentMatches
  ) as PersonHit | undefined;

  let parentPersonId = parentHit?.id;
  if (!parentPersonId) {
    const { data: createdParentId, error: parentPersonError } =
      await supabase.rpc("create_person_record", {
        p_full_name: guardian.fullName,
        p_phone: guardian.phone || null,
        p_email: guardian.email || null,
      });
    if (parentPersonError || !createdParentId) {
      return {
        error: parentPersonError?.message ?? "Could not save parent.",
      };
    }
    parentPersonId = createdParentId as string;
  } else {
    await supabase.rpc("update_person_record", {
      p_person_id: parentPersonId,
      p_full_name: guardian.fullName,
      p_phone: guardian.phone || null,
      p_email: guardian.email || parentHit?.email,
    });
  }

  const { data: parentProfileId, error: parentProfileError } = await supabase.rpc(
    "create_parent_profile_record",
    { p_person_id: parentPersonId },
  );
  if (parentProfileError || !parentProfileId) {
    return {
      error: parentProfileError?.message ?? "Could not create parent profile.",
    };
  }
  return {
    personId: parentPersonId,
    parentProfileId: String(parentProfileId),
  };
}

function mapAdmissionToStudentRow(
  admission: {
    admission_number: string;
    student_profiles: unknown;
    student_academic_years: unknown;
  },
  classNameById: Map<string, string>,
  sectionNameById: Map<string, string>,
): StudentFormRow {
  const profileRaw = admission.student_profiles as
    | {
        persons:
          | {
              full_name: string;
              date_of_birth: string | null;
              gender: string | null;
              email: string | null;
              aadhaar_last4: string | null;
            }
          | {
              full_name: string;
              date_of_birth: string | null;
              gender: string | null;
              email: string | null;
              aadhaar_last4: string | null;
            }[]
          | null;
        student_parent_links: unknown;
      }
    | {
        persons:
          | {
              full_name: string;
              date_of_birth: string | null;
              gender: string | null;
              email: string | null;
              aadhaar_last4: string | null;
            }
          | {
              full_name: string;
              date_of_birth: string | null;
              gender: string | null;
              email: string | null;
              aadhaar_last4: string | null;
            }[]
          | null;
        student_parent_links: unknown;
      }[]
    | null;

  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
  const personRaw = profile?.persons;
  const person = Array.isArray(personRaw) ? personRaw[0] : personRaw;
  const years = Array.isArray(admission.student_academic_years)
    ? admission.student_academic_years
    : [];
  const active = years.find((row) => row.status === "active" && !row.left_on);
  const links = Array.isArray(profile?.student_parent_links)
    ? profile.student_parent_links
    : [];

  return {
    fullName: person?.full_name ?? "",
    dateOfBirth: person?.date_of_birth ?? "",
    gender: (person?.gender as "" | "male" | "female" | "other") ?? "",
    admissionNumber: admission.admission_number,
    aadhaar: person?.aadhaar_last4 ? `********${person.aadhaar_last4}` : "",
    email: person?.email ?? "",
    className: active ? (classNameById.get(active.class_id) ?? "") : "",
    sectionName: active ? (sectionNameById.get(active.section_id) ?? "") : "",
    guardians: links.map((link) => {
      const typed = link as {
        relationship: string;
        parent_profiles:
          | {
              persons:
                | {
                    full_name: string;
                    phone: string | null;
                    email: string | null;
                  }
                | {
                    full_name: string;
                    phone: string | null;
                    email: string | null;
                  }[]
                | null;
            }
          | {
              persons:
                | {
                    full_name: string;
                    phone: string | null;
                    email: string | null;
                  }
                | {
                    full_name: string;
                    phone: string | null;
                    email: string | null;
                  }[]
                | null;
            }[]
          | null;
      };
      const parentProfile = Array.isArray(typed.parent_profiles)
        ? typed.parent_profiles[0]
        : typed.parent_profiles;
      const parentPersonRaw = parentProfile?.persons;
      const parentPerson = Array.isArray(parentPersonRaw)
        ? parentPersonRaw[0]
        : parentPersonRaw;
      return {
        fullName: parentPerson?.full_name ?? "",
        relationship: typed.relationship,
        phone: parentPerson?.phone ?? "",
        whatsappNumber: parentPerson?.phone ?? "",
        email: parentPerson?.email ?? "",
        whatsappOptIn: false,
      };
    }),
  };
}
