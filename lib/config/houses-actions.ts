"use server";

import { revalidatePath } from "next/cache";
import { ensureHouseCode } from "@/lib/config/codes";
import { trimHouseInputs, validateHouseInputs } from "@/lib/config/houses";
import type { ConfigActionResult, HouseInput } from "@/lib/config/types";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listHousesAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | {
      success: true;
      houses: Array<{
        id: string;
        name: string;
        code: string | null;
        display_order: number;
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
    .select("id, name, code, display_order, archived_at")
    .eq("school_id", schoolId)
    .order("display_order", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, houses: data ?? [] };
}

export async function syncHousesCatalogAction(
  inputs: HouseInput[],
  options: { requireAtLeastOne?: boolean; archiveMissing?: boolean } = {},
): Promise<ConfigActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const archiveMissing = options.archiveMissing ?? true;
  const trimmed = trimHouseInputs(inputs);
  const fieldErrors = validateHouseInputs(trimmed, {
    requireAtLeastOne: options.requireAtLeastOne,
  });

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from("houses")
    .select("id, name, code, archived_at")
    .eq("school_id", schoolId);

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  const byId = new Map((existing ?? []).map((row) => [row.id, row]));
  const activeByName = new Map(
    (existing ?? [])
      .filter((row) => row.archived_at == null)
      .map((row) => [row.name.toLowerCase(), row]),
  );
  const keptIds = new Set<string>();

  for (const [index, row] of trimmed.entries()) {
    const code = ensureHouseCode(row.name, row.code);
    const matched =
      (row.id ? byId.get(row.id) : undefined) ??
      activeByName.get(row.name.toLowerCase());

    if (matched) {
      const { error: updateError } = await supabase
        .from("houses")
        .update({
          name: row.name,
          code: matched.code && matched.code.trim() ? matched.code : code,
          display_order: row.displayOrder ?? index,
          archived_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", matched.id)
        .eq("school_id", schoolId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
      keptIds.add(matched.id);
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("houses")
      .insert({
        school_id: schoolId,
        name: row.name,
        code,
        display_order: row.displayOrder ?? index,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !inserted) {
      return {
        success: false,
        error: insertError?.message ?? "Could not create house.",
      };
    }
    keptIds.add(inserted.id);
  }

  if (archiveMissing) {
    for (const row of existing ?? []) {
      if (row.archived_at != null || keptIds.has(row.id)) {
        continue;
      }
      const { error: archiveError } = await supabase
        .from("houses")
        .update({
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("school_id", schoolId);

      if (archiveError) {
        return { success: false, error: archiveError.message };
      }
    }
  }

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "Houses saved." };
}

export async function archiveHouseAction(
  houseId: string,
): Promise<ConfigActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { error } = await supabase
    .from("houses")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", houseId)
    .eq("school_id", schoolId)
    .is("archived_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "House archived.", id: houseId };
}

export async function restoreHouseAction(
  houseId: string,
): Promise<ConfigActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { error } = await supabase
    .from("houses")
    .update({
      archived_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", houseId)
    .eq("school_id", schoolId);

  if (error) {
    return {
      success: false,
      error:
        error.code === "23505"
          ? "Cannot restore: an active house already uses this name or code."
          : error.message,
    };
  }

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "House restored.", id: houseId };
}
