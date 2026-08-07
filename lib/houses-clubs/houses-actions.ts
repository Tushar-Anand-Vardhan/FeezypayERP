"use server";

import { revalidatePath } from "next/cache";
import { ensureHouseCode } from "@/lib/config/codes";
import {
  assertEmploymentOwned,
  assertHouseOwned,
  assertYearOwned,
  getActorId,
} from "@/lib/houses-clubs/server-helpers";
import type {
  HouseCatalogInput,
  HouseClubActionResult,
} from "@/lib/houses-clubs/types";
import {
  trimHouseCatalogInput,
  validateHouseCatalogInput,
} from "@/lib/houses-clubs/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/houses-clubs");
  revalidatePath("/onboarding", "layout");
}

export async function listHousesCatalogAction(options?: {
  includeArchived?: boolean;
  academicYearId?: string | null;
}): Promise<
  | {
      success: true;
      houses: Array<{
        id: string;
        name: string;
        code: string | null;
        description: string | null;
        colour: string | null;
        secondary_colour: string | null;
        logo_path: string | null;
        academic_year_id: string | null;
        teacher_in_charge_employment_id: string | null;
        display_order: number;
        points_tracking_enabled: boolean;
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
    .from("houses")
    .select(
      "id, name, code, description, colour, secondary_colour, logo_path, academic_year_id, teacher_in_charge_employment_id, display_order, points_tracking_enabled, archived_at",
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

  return { success: true, houses: data ?? [] };
}

export async function createHouseAction(
  input: HouseCatalogInput,
): Promise<HouseClubActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimHouseCatalogInput(input);
  const fieldErrors = validateHouseCatalogInput(trimmed);
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
    .from("houses")
    .insert({
      school_id: schoolId,
      name: trimmed.name,
      code: ensureHouseCode(trimmed.name, trimmed.code),
      description: trimmed.description || null,
      colour: trimmed.colour || null,
      secondary_colour: trimmed.secondaryColour || null,
      logo_path: trimmed.logoPath,
      academic_year_id: trimmed.academicYearId,
      teacher_in_charge_employment_id: trimmed.teacherInChargeEmploymentId,
      display_order: trimmed.displayOrder ?? 0,
      points_tracking_enabled: trimmed.pointsTrackingEnabled ?? false,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create house.",
    };
  }

  revalidate();
  return { success: true, message: "House created.", id: data.id };
}

export async function updateHouseAction(
  input: HouseCatalogInput & { id: string },
): Promise<HouseClubActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimHouseCatalogInput(input);
  const fieldErrors = validateHouseCatalogInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (!(await assertHouseOwned(supabase, schoolId, input.id))) {
    return { success: false, error: "House not found." };
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
    .from("houses")
    .update({
      name: trimmed.name,
      code: ensureHouseCode(trimmed.name, trimmed.code),
      description: trimmed.description || null,
      colour: trimmed.colour || null,
      secondary_colour: trimmed.secondaryColour || null,
      logo_path: trimmed.logoPath,
      academic_year_id: trimmed.academicYearId,
      teacher_in_charge_employment_id: trimmed.teacherInChargeEmploymentId,
      display_order: trimmed.displayOrder ?? 0,
      points_tracking_enabled: trimmed.pointsTrackingEnabled ?? false,
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
  return { success: true, message: "House updated.", id: input.id };
}

export async function archiveHouseAction(
  houseId: string,
): Promise<HouseClubActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("houses")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", houseId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "House archived.", id: houseId };
}

export async function restoreHouseAction(
  houseId: string,
): Promise<HouseClubActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("houses")
    .update({
      archived_at: null,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", houseId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "House restored.", id: houseId };
}

export async function setHouseTeacherInChargeAction(
  houseId: string,
  employmentId: string | null,
): Promise<HouseClubActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertHouseOwned(supabase, schoolId, houseId))) {
    return { success: false, error: "House not found." };
  }
  if (
    employmentId &&
    !(await assertEmploymentOwned(supabase, schoolId, employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("houses")
    .update({
      teacher_in_charge_employment_id: employmentId,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", houseId)
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
    id: houseId,
  };
}
