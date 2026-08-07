"use server";

import { revalidatePath } from "next/cache";
import { ensureClubCode } from "@/lib/config/codes";
import {
  assertClubOwned,
  assertEmploymentOwned,
  assertYearOwned,
  getActorId,
} from "@/lib/houses-clubs/server-helpers";
import type {
  ClubCatalogInput,
  HouseClubActionResult,
} from "@/lib/houses-clubs/types";
import {
  trimClubCatalogInput,
  validateClubCatalogInput,
} from "@/lib/houses-clubs/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/houses-clubs");
  revalidatePath("/onboarding", "layout");
}

export async function listClubsCatalogAction(options?: {
  includeArchived?: boolean;
  academicYearId?: string | null;
}): Promise<
  | {
      success: true;
      clubs: Array<{
        id: string;
        name: string;
        code: string | null;
        description: string | null;
        colour: string | null;
        logo_path: string | null;
        academic_year_id: string | null;
        teacher_in_charge_employment_id: string | null;
        display_order: number;
        events_enabled: boolean;
        archived_at: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("clubs")
    .select(
      "id, name, code, description, colour, logo_path, academic_year_id, teacher_in_charge_employment_id, display_order, events_enabled, archived_at",
    )
    .eq("school_id", schoolId)
    .order("display_order", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (options?.academicYearId) {
    query = query.eq("academic_year_id", options.academicYearId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, clubs: data ?? [] };
}

export async function createClubAction(
  input: ClubCatalogInput,
): Promise<HouseClubActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimClubCatalogInput(input);
  const fieldErrors = validateClubCatalogInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  if (
    trimmed.academicYearId &&
    !(await assertYearOwned(supabase, schoolId, trimmed.academicYearId))
  ) {
    return { success: false, error: "Academic year not found." };
  }
  if (
    trimmed.teacherInChargeEmploymentId &&
    !(await assertEmploymentOwned(
      supabase,
      schoolId,
      trimmed.teacherInChargeEmploymentId,
    ))
  ) {
    return { success: false, error: "Teacher in charge employment not found." };
  }

  const { data, error } = await supabase
    .from("clubs")
    .insert({
      school_id: schoolId,
      name: trimmed.name,
      code: ensureClubCode(trimmed.name, trimmed.code),
      description: trimmed.description || null,
      colour: trimmed.colour || null,
      logo_path: trimmed.logoPath,
      academic_year_id: trimmed.academicYearId,
      teacher_in_charge_employment_id: trimmed.teacherInChargeEmploymentId,
      display_order: trimmed.displayOrder ?? 0,
      events_enabled: trimmed.eventsEnabled ?? false,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create club.",
    };
  }

  revalidate();
  return { success: true, message: "Club created.", id: data.id };
}

export async function updateClubAction(
  input: ClubCatalogInput & { id: string },
): Promise<HouseClubActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimClubCatalogInput(input);
  const fieldErrors = validateClubCatalogInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (!(await assertClubOwned(supabase, schoolId, input.id))) {
    return { success: false, error: "Club not found." };
  }

  if (
    trimmed.academicYearId &&
    !(await assertYearOwned(supabase, schoolId, trimmed.academicYearId))
  ) {
    return { success: false, error: "Academic year not found." };
  }
  if (
    trimmed.teacherInChargeEmploymentId &&
    !(await assertEmploymentOwned(
      supabase,
      schoolId,
      trimmed.teacherInChargeEmploymentId,
    ))
  ) {
    return { success: false, error: "Teacher in charge employment not found." };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("clubs")
    .update({
      name: trimmed.name,
      code: ensureClubCode(trimmed.name, trimmed.code),
      description: trimmed.description || null,
      colour: trimmed.colour || null,
      logo_path: trimmed.logoPath,
      academic_year_id: trimmed.academicYearId,
      teacher_in_charge_employment_id: trimmed.teacherInChargeEmploymentId,
      display_order: trimmed.displayOrder ?? 0,
      events_enabled: trimmed.eventsEnabled ?? false,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("school_id", schoolId)
    .is("archived_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Club updated.", id: input.id };
}

export async function archiveClubAction(
  clubId: string,
): Promise<HouseClubActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("clubs")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clubId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Club archived.", id: clubId };
}

export async function restoreClubAction(
  clubId: string,
): Promise<HouseClubActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("clubs")
    .update({
      archived_at: null,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clubId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Club restored.", id: clubId };
}

export async function setClubTeacherInChargeAction(
  clubId: string,
  employmentId: string | null,
): Promise<HouseClubActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertClubOwned(supabase, schoolId, clubId))) {
    return { success: false, error: "Club not found." };
  }
  if (
    employmentId &&
    !(await assertEmploymentOwned(supabase, schoolId, employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("clubs")
    .update({
      teacher_in_charge_employment_id: employmentId,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clubId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return {
    success: true,
    message: employmentId
      ? "Teacher in charge assigned."
      : "Teacher in charge cleared.",
    id: clubId,
  };
}
