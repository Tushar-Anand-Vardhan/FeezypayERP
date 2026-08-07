"use server";

import { revalidatePath } from "next/cache";
import {
  trimSchoolBrandingInput,
  validateSchoolBrandingInput,
} from "@/lib/config/school-branding";
import type { ConfigActionResult, SchoolBrandingInput } from "@/lib/config/types";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

/**
 * Updates E07 branding/config columns only.
 * Does not write academic_year_start_month (E08) or onboarding flags (E25).
 */
export async function updateSchoolBrandingAction(
  input: SchoolBrandingInput,
): Promise<ConfigActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimSchoolBrandingInput(input);
  const fieldErrors = validateSchoolBrandingInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const patch: Record<string, unknown> = {
    name: trimmed.name,
    address_street: trimmed.addressStreet || null,
    address_city: trimmed.addressCity || null,
    address_state: trimmed.addressState || null,
    address_pincode: trimmed.addressPincode || null,
    contact_phone: trimmed.contactPhone || null,
    contact_email: trimmed.contactEmail || null,
    board: trimmed.board,
    affiliation_number: trimmed.affiliationNumber || null,
    updated_at: new Date().toISOString(),
  };

  if (typeof trimmed.housesEnabled === "boolean") {
    patch.houses_enabled = trimmed.housesEnabled;
  }
  if (typeof trimmed.clubsEnabled === "boolean") {
    patch.clubs_enabled = trimmed.clubsEnabled;
  }
  if (trimmed.logoPath !== undefined) {
    patch.logo_path = trimmed.logoPath;
  }

  const { error } = await supabase
    .from("schools")
    .update(patch)
    .eq("id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/onboarding", "layout");
  revalidatePath("/dashboard");
  return { success: true, message: "School branding saved." };
}
