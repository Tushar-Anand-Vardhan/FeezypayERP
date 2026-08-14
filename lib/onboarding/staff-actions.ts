"use server";

import { revalidatePath } from "next/cache";
import { hashAadhaar } from "@/lib/identity/aadhaar";
import { getActiveYearClassesForSchool } from "@/lib/onboarding/school-classes-server";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import {
  trimStaffRows,
  validateStaffRows,
  type StaffFormRow,
} from "@/lib/onboarding/staff";
import { syncStaffMembership } from "@/lib/membership/sync";

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
    teachers: (employments ?? []).map((employment) => {
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
            const subject = link.subjects as
              | { name: string }
              | { name: string }[]
              | null;
            if (Array.isArray(subject)) {
              return subject[0]?.name ?? "";
            }
            return subject?.name ?? "";
          })
          .filter(Boolean),
        isHod: employment.is_hod,
      };
    }),
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

  // Masked aadhaar from reload should not be re-hashed; clear fake values.
  rows = rows.map((row) => ({
    ...row,
    aadhaar: row.aadhaar.includes("*") ? "" : row.aadhaar,
  }));

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

  const departmentNames = Array.from(
    new Set(trimmed.map((row) => row.departmentName).filter(Boolean)),
  );

  const { data: existingDepartments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("school_id", schoolId);

  const departmentIdByName = new Map(
    (existingDepartments ?? []).map((row) => [row.name.toLowerCase(), row.id]),
  );

  for (const name of departmentNames) {
    if (!departmentIdByName.has(name.toLowerCase())) {
      const { data: inserted, error } = await supabase
        .from("departments")
        .insert({ school_id: schoolId, name })
        .select("id, name")
        .single();
      if (error || !inserted) {
        return {
          success: false,
          error: error?.message ?? "Could not create department.",
        };
      }
      departmentIdByName.set(inserted.name.toLowerCase(), inserted.id);
    }
  }

  // Soft-end employments removed from the list; upsert the rest in place.
  const { data: existingEmployments } = await supabase
    .from("teacher_employments")
    .select("id, teacher_profile_id, status")
    .eq("school_id", schoolId)
    .in("status", ["active", "invited"]);

  const keepEmploymentIds = new Set<string>();
  const invitesToSend: Array<{
    email: string;
    personId: string;
    employmentId: string;
    isHod: boolean;
    isNew: boolean;
  }> = [];

  for (const row of trimmed) {
    const resolved = await resolvePersonAndTeacherProfile(supabase, row);
    if ("error" in resolved) {
      return { success: false, error: resolved.error };
    }

    const existing = (existingEmployments ?? []).find(
      (rowEmployment) =>
        rowEmployment.teacher_profile_id === resolved.teacherProfileId,
    );

    let employmentId = existing?.id;
    let isNewEmployment = false;
    const schoolPersona = row.isHod ? "hod" : "teacher";

    if (employmentId) {
      const { error: updateError } = await supabase
        .from("teacher_employments")
        .update({
          employee_code: row.employeeCode || null,
          designation: row.designation || null,
          department_id: row.departmentName
            ? (departmentIdByName.get(row.departmentName.toLowerCase()) ?? null)
            : null,
          is_hod: row.isHod,
          school_persona: schoolPersona,
          status: existing?.status === "invited" ? "invited" : "active",
          left_on: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", employmentId);
      if (updateError) {
        return { success: false, error: updateError.message };
      }

      await supabase
        .from("employment_subjects")
        .delete()
        .eq("employment_id", employmentId);
    } else {
      isNewEmployment = true;
      const { assertNoOtherActiveEmployment } = await import(
        "@/lib/workforce/employment-guards"
      );
      const d15 = await assertNoOtherActiveEmployment(
        supabase,
        resolved.teacherProfileId,
        schoolId,
      );
      if (!d15.ok) {
        return {
          success: false,
          error: `${row.fullName}: ${d15.error}`,
        };
      }
      const { data: employment, error: employmentError } = await supabase
        .from("teacher_employments")
        .insert({
          teacher_profile_id: resolved.teacherProfileId,
          school_id: schoolId,
          employee_code: row.employeeCode || null,
          designation: row.designation || null,
          department_id: row.departmentName
            ? (departmentIdByName.get(row.departmentName.toLowerCase()) ?? null)
            : null,
          is_hod: row.isHod,
          school_persona: schoolPersona,
          status: row.email ? "invited" : "active",
          joined_on: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single();

      if (employmentError || !employment) {
        return {
          success: false,
          error: employmentError?.message ?? "Could not save employment.",
        };
      }
      employmentId = employment.id;
    }

    keepEmploymentIds.add(employmentId);

    await syncStaffMembership(supabase, employmentId);

    if (row.subjectNames.length > 0) {
      const links = row.subjectNames
        .map((name) => subjectByName.get(name.toLowerCase()))
        .filter((id): id is string => Boolean(id))
        .map((subjectId) => ({
          employment_id: employmentId!,
          subject_id: subjectId,
        }));

      if (links.length > 0) {
        const { error: linkError } = await supabase
          .from("employment_subjects")
          .insert(links);
        if (linkError) {
          return { success: false, error: linkError.message };
        }
      }
    }

    if (row.email && isNewEmployment) {
      invitesToSend.push({
        email: row.email,
        personId: resolved.personId,
        employmentId,
        isHod: row.isHod,
        isNew: true,
      });
    }
  }

  const toEnd = (existingEmployments ?? [])
    .map((row) => row.id)
    .filter((id) => !keepEmploymentIds.has(id));

  if (toEnd.length > 0) {
    await supabase
      .from("teacher_employments")
      .update({
        status: "ended",
        left_on: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .in("id", toEnd);

    for (const endedId of toEnd) {
      await syncStaffMembership(supabase, endedId);
    }
  }

  const inviteWarnings: string[] = [];
  if (invitesToSend.length > 0) {
    const { createInviteAction } = await import("@/lib/auth/invites-actions");
    for (const invite of invitesToSend) {
      const result = await createInviteAction({
        email: invite.email,
        personId: invite.personId,
        targetPersona: invite.isHod ? "hod" : "teacher",
        employmentId: invite.employmentId,
      });
      if (!result.success) {
        inviteWarnings.push(`${invite.email}: ${result.error}`);
      } else if (result.warning) {
        inviteWarnings.push(`${invite.email}: ${result.warning}`);
      }
    }
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
