"use server";

import { revalidatePath } from "next/cache";
import {
  assertHouseOwned,
  assertStudentAdmitted,
  assertYearOwned,
  getActorId,
  syncAdmissionHousePointer,
} from "@/lib/houses-clubs/server-helpers";
import type {
  HouseClubActionResult,
  HouseMembershipInput,
  MembershipRole,
} from "@/lib/houses-clubs/types";
import { validateHouseMembershipInput } from "@/lib/houses-clubs/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/houses-clubs");
}

async function endRoleHolders(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  houseId: string,
  role: MembershipRole,
  academicYearId: string | null,
  exceptStudentId?: string,
): Promise<void> {
  if (role !== "captain" && role !== "vice_captain") {
    return;
  }

  let query = supabase
    .from("house_memberships")
    .select("id, student_profile_id")
    .eq("house_id", houseId)
    .eq("role", role)
    .is("left_on", null);

  query = academicYearId
    ? query.eq("academic_year_id", academicYearId)
    : query.is("academic_year_id", null);

  const { data } = await query;
  const today = new Date().toISOString().slice(0, 10);
  for (const row of data ?? []) {
    if (exceptStudentId && row.student_profile_id === exceptStudentId) {
      continue;
    }
    await supabase
      .from("house_memberships")
      .update({ left_on: today, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }
}

export async function listHouseMembershipsAction(
  houseId: string,
  options?: { includeEnded?: boolean },
): Promise<
  | {
      success: true;
      memberships: Array<{
        id: string;
        student_profile_id: string;
        role: string;
        academic_year_id: string | null;
        joined_on: string;
        left_on: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertHouseOwned(supabase, schoolId, houseId))) {
    return { success: false, error: "House not found." };
  }

  let query = supabase
    .from("house_memberships")
    .select(
      "id, student_profile_id, role, academic_year_id, joined_on, left_on",
    )
    .eq("house_id", houseId)
    .order("joined_on", { ascending: false });

  if (!options?.includeEnded) {
    query = query.is("left_on", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, memberships: data ?? [] };
}

export async function addHouseMembershipAction(
  input: HouseMembershipInput,
): Promise<HouseClubActionResult> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateHouseMembershipInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const houseId = input.houseId.trim();
  const studentProfileId = input.studentProfileId.trim();
  const role = input.role ?? "member";
  const academicYearId = input.academicYearId?.trim() || null;

  if (!(await assertHouseOwned(supabase, schoolId, houseId))) {
    return { success: false, error: "House not found." };
  }
  if (!(await assertStudentAdmitted(supabase, schoolId, studentProfileId))) {
    return { success: false, error: "Student is not admitted at this school." };
  }
  if (
    academicYearId &&
    !(await assertYearOwned(supabase, schoolId, academicYearId))
  ) {
    return { success: false, error: "Academic year not found." };
  }

  const actorId = await getActorId(supabase);
  await endRoleHolders(
    supabase,
    houseId,
    role,
    academicYearId,
    studentProfileId,
  );

  let existingQuery = supabase
    .from("house_memberships")
    .select("id")
    .eq("house_id", houseId)
    .eq("student_profile_id", studentProfileId)
    .is("left_on", null);

  existingQuery = academicYearId
    ? existingQuery.eq("academic_year_id", academicYearId)
    : existingQuery.is("academic_year_id", null);

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("house_memberships")
      .update({
        role,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      return { success: false, error: error.message };
    }

    await syncAdmissionHousePointer(supabase, schoolId, studentProfileId);
    revalidate();
    return { success: true, message: "House membership updated.", id: existing.id };
  }

  const { data, error } = await supabase
    .from("house_memberships")
    .insert({
      house_id: houseId,
      student_profile_id: studentProfileId,
      academic_year_id: academicYearId,
      role,
      joined_on: input.joinedOn || new Date().toISOString().slice(0, 10),
      notes: input.notes?.trim() || null,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not add house membership.",
    };
  }

  await syncAdmissionHousePointer(supabase, schoolId, studentProfileId);
  revalidate();
  return { success: true, message: "House membership added.", id: data.id };
}

export async function endHouseMembershipAction(
  membershipId: string,
  leftOn?: string,
): Promise<HouseClubActionResult> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: row } = await supabase
    .from("house_memberships")
    .select("id, house_id, student_profile_id, left_on")
    .eq("id", membershipId)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Membership not found." };
  }
  if (!(await assertHouseOwned(supabase, schoolId, row.house_id))) {
    return { success: false, error: "House not found." };
  }
  if (row.left_on) {
    return { success: false, error: "Membership already ended." };
  }

  const { error } = await supabase
    .from("house_memberships")
    .update({
      left_on: leftOn || new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("id", membershipId);

  if (error) {
    return { success: false, error: error.message };
  }

  await syncAdmissionHousePointer(supabase, schoolId, row.student_profile_id);
  revalidate();
  return { success: true, message: "House membership ended.", id: membershipId };
}

export async function importHouseMembershipsCsvAction(input: {
  csvText: string;
  academicYearId: string;
}): Promise<
  | { success: true; message: string; imported: number }
  | { success: false; error: string; fieldErrors?: Record<string, string> }
> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { parseHouseMembershipCsv } = await import(
    "@/lib/houses-clubs/house-memberships-csv"
  );
  const parsed = parseHouseMembershipCsv(input.csvText);
  if (!parsed.ok) {
    return {
      success: false,
      error: parsed.error,
      fieldErrors: parsed.fieldErrors,
    };
  }

  const { supabase, schoolId } = context;

  const { data: yearOk } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", input.academicYearId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!yearOk) {
    return { success: false, error: "Academic year not found." };
  }

  const { data: houses } = await supabase
    .from("houses")
    .select("id, code, name")
    .eq("school_id", schoolId)
    .is("archived_at", null);

  const houseByCode = new Map(
    (houses ?? [])
      .filter((h) => h.code)
      .map((h) => [String(h.code).toLowerCase(), h.id]),
  );
  // Also allow matching by name when code blank in CSV? Plan says house_code — keep strict.

  const { data: admissions } = await supabase
    .from("student_admissions")
    .select("id, admission_number, student_profile_id")
    .eq("school_id", schoolId)
    .eq("status", "active");

  const admissionByNumber = new Map(
    (admissions ?? []).map((a) => [
      a.admission_number.toLowerCase(),
      a,
    ]),
  );

  const fieldErrors: Record<string, string> = {};
  const resolved: Array<{
    studentProfileId: string;
    houseId: string;
    role: import("@/lib/houses-clubs/types").MembershipRole;
  }> = [];

  for (const row of parsed.rows) {
    const admission = admissionByNumber.get(row.admissionNumber.toLowerCase());
    if (!admission) {
      fieldErrors[`row-${row.line}`] =
        `No active admission for ${row.admissionNumber}.`;
      continue;
    }
    const houseId = houseByCode.get(row.houseCode.toLowerCase());
    if (!houseId) {
      fieldErrors[`row-${row.line}`] = `Unknown house_code ${row.houseCode}.`;
      continue;
    }
    resolved.push({
      studentProfileId: admission.student_profile_id,
      houseId,
      role: row.role,
    });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Fix CSV errors before importing (blocking validation).",
      fieldErrors,
    };
  }

  let imported = 0;
  for (const row of resolved) {
    const result = await addHouseMembershipAction({
      houseId: row.houseId,
      studentProfileId: row.studentProfileId,
      academicYearId: input.academicYearId,
      role: row.role,
    });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    imported += 1;
  }

  revalidate();
  return {
    success: true,
    message: `Imported ${imported} house membership(s).`,
    imported,
  };
}

/** Active admissions with no house membership for the year (for flash UI). */
export async function listStudentsWithoutHouseAction(
  academicYearId: string,
): Promise<
  | {
      success: true;
      unassigned: Array<{
        admissionId: string;
        studentProfileId: string;
        fullName: string;
        admissionNumber: string | null;
        className: string | null;
        sectionName: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("config.catalog.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  const { data: memberships } = await supabase
    .from("house_memberships")
    .select("student_profile_id, houses!inner(school_id)")
    .eq("academic_year_id", academicYearId)
    .eq("houses.school_id", schoolId)
    .is("left_on", null);

  const assigned = new Set(
    (memberships ?? []).map((m) => m.student_profile_id),
  );

  const { data: admissions, error } = await supabase
    .from("student_admissions")
    .select(
      "id, admission_number, student_profile_id, student_profiles(persons(full_name))",
    )
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (error) {
    return { success: false, error: error.message };
  }

  const unassignedProfiles = (admissions ?? []).filter(
    (a) => !assigned.has(a.student_profile_id),
  );

  const admissionIds = unassignedProfiles.map((a) => a.id);
  const placementByAdmission = new Map<
    string,
    { className: string | null; sectionName: string | null }
  >();

  if (admissionIds.length > 0) {
    const { data: placements } = await supabase
      .from("student_academic_years")
      .select("admission_id, classes(name), sections(name)")
      .eq("academic_year_id", academicYearId)
      .in("admission_id", admissionIds)
      .eq("status", "active")
      .is("left_on", null);

    for (const p of placements ?? []) {
      const cls = p.classes as
        | { name?: string }
        | { name?: string }[]
        | null;
      const sec = p.sections as
        | { name?: string }
        | { name?: string }[]
        | null;
      placementByAdmission.set(p.admission_id, {
        className: Array.isArray(cls) ? cls[0]?.name ?? null : cls?.name ?? null,
        sectionName: Array.isArray(sec)
          ? sec[0]?.name ?? null
          : sec?.name ?? null,
      });
    }
  }

  const unassigned = unassignedProfiles.map((a) => {
    const profile = a.student_profiles as
      | {
          persons?:
            | { full_name?: string }
            | { full_name?: string }[]
            | null;
        }
      | {
          persons?:
            | { full_name?: string }
            | { full_name?: string }[]
            | null;
        }[]
      | null;
    const p = Array.isArray(profile) ? profile[0] : profile;
    const person = Array.isArray(p?.persons) ? p?.persons[0] : p?.persons;
    const placement = placementByAdmission.get(a.id);
    return {
      admissionId: a.id,
      studentProfileId: a.student_profile_id,
      fullName: person?.full_name ?? "Student",
      admissionNumber: a.admission_number,
      className: placement?.className ?? null,
      sectionName: placement?.sectionName ?? null,
    };
  });

  return { success: true, unassigned };
}
