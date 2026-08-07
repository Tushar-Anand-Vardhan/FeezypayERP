"use server";

import { revalidatePath } from "next/cache";
import {
  assertClubOwned,
  assertStudentAdmitted,
  assertYearOwned,
  getActorId,
} from "@/lib/houses-clubs/server-helpers";
import type {
  ClubMembershipInput,
  HouseClubActionResult,
  MembershipRole,
} from "@/lib/houses-clubs/types";
import { validateClubMembershipInput } from "@/lib/houses-clubs/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/houses-clubs");
  revalidatePath("/onboarding", "layout");
}

async function endRoleHolders(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  clubId: string,
  role: MembershipRole,
  academicYearId: string | null,
  exceptStudentId?: string,
): Promise<void> {
  if (role !== "captain" && role !== "vice_captain") {
    return;
  }

  let query = supabase
    .from("club_memberships")
    .select("id, student_profile_id")
    .eq("club_id", clubId)
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
      .from("club_memberships")
      .update({ left_on: today, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }
}

export async function listClubMembershipsAction(
  clubId: string,
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
  if (!(await assertClubOwned(supabase, schoolId, clubId))) {
    return { success: false, error: "Club not found." };
  }

  let query = supabase
    .from("club_memberships")
    .select(
      "id, student_profile_id, role, academic_year_id, joined_on, left_on",
    )
    .eq("club_id", clubId)
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

export async function addClubMembershipAction(
  input: ClubMembershipInput,
): Promise<HouseClubActionResult> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateClubMembershipInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const clubId = input.clubId.trim();
  const studentProfileId = input.studentProfileId.trim();
  const role = input.role ?? "member";
  const academicYearId = input.academicYearId?.trim() || null;

  if (!(await assertClubOwned(supabase, schoolId, clubId))) {
    return { success: false, error: "Club not found." };
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
  await endRoleHolders(supabase, clubId, role, academicYearId, studentProfileId);

  let existingQuery = supabase
    .from("club_memberships")
    .select("id")
    .eq("club_id", clubId)
    .eq("student_profile_id", studentProfileId)
    .is("left_on", null);

  existingQuery = academicYearId
    ? existingQuery.eq("academic_year_id", academicYearId)
    : existingQuery.is("academic_year_id", null);

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("club_memberships")
      .update({
        role,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidate();
    return { success: true, message: "Club membership updated.", id: existing.id };
  }

  const { data, error } = await supabase
    .from("club_memberships")
    .insert({
      club_id: clubId,
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
      error:
        error?.code === "23505"
          ? "Student is already an active member of this club."
          : (error?.message ?? "Could not add club membership."),
    };
  }

  revalidate();
  return { success: true, message: "Club membership added.", id: data.id };
}

export async function endClubMembershipAction(
  membershipId: string,
  leftOn?: string,
): Promise<HouseClubActionResult> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: row } = await supabase
    .from("club_memberships")
    .select("id, club_id, left_on, clubs!inner(school_id)")
    .eq("id", membershipId)
    .eq("clubs.school_id", schoolId)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Membership not found." };
  }
  if (row.left_on) {
    return { success: false, error: "Membership already ended." };
  }

  const { error } = await supabase
    .from("club_memberships")
    .update({
      left_on: leftOn || new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("id", membershipId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Club membership ended.", id: membershipId };
}

/** @deprecated Prefer addClubMembershipAction — kept for config re-exports. */
export async function joinClubAction(input: {
  clubId: string;
  studentProfileId: string;
  joinedOn?: string;
}): Promise<HouseClubActionResult> {
  return addClubMembershipAction({
    clubId: input.clubId,
    studentProfileId: input.studentProfileId,
    joinedOn: input.joinedOn,
    role: "member",
  });
}

/** @deprecated Prefer endClubMembershipAction */
export async function leaveClubAction(
  membershipId: string,
  leftOn?: string,
): Promise<HouseClubActionResult> {
  return endClubMembershipAction(membershipId, leftOn);
}
