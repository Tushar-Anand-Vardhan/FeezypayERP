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
  const context = await getAuthenticatedSchoolContext();
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
  const context = await getAuthenticatedSchoolContext();
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
  const context = await getAuthenticatedSchoolContext();
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
