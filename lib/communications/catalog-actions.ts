"use server";

import { revalidatePath } from "next/cache";
import { getActorId } from "@/lib/communications/server-helpers";
import type {
  CategoryInput,
  CommActionResult,
  PriorityInput,
} from "@/lib/communications/types";
import {
  ensureCommCode,
  validateCategoryInput,
  validatePriorityInput,
} from "@/lib/communications/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/communications");
}

export async function listAnnouncementCategoriesAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | {
      success: true;
      categories: Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        colour: string | null;
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
    .from("comm_announcement_categories")
    .select(
      "id, code, name, description, colour, display_order, archived_at",
    )
    .eq("school_id", schoolId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, categories: data ?? [] };
}

export async function upsertAnnouncementCategoryAction(
  input: CategoryInput,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateCategoryInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const payload = {
    school_id: schoolId,
    code: ensureCommCode(input.name, input.code, "CAT"),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    colour: input.colour?.trim() || null,
    display_order: input.displayOrder ?? 0,
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("comm_announcement_categories")
      .update(payload)
      .eq("id", input.id)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return { success: false, error: error?.message ?? "Category not found." };
    }
    revalidate();
    return { success: true, message: "Category updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("comm_announcement_categories")
    .insert({ ...payload, created_by: actorId })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create category.",
    };
  }
  revalidate();
  return { success: true, message: "Category created.", id: data.id };
}

export async function archiveAnnouncementCategoryAction(
  categoryId: string,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data, error } = await supabase
    .from("comm_announcement_categories")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", categoryId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Category not found." };
  }
  revalidate();
  return { success: true, message: "Category archived.", id: data.id };
}

export async function listPriorityLevelsAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | {
      success: true;
      priorities: Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        rank: number;
        bypass_quiet_hours: boolean;
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
    .from("comm_priority_levels")
    .select(
      "id, code, name, description, rank, bypass_quiet_hours, display_order, archived_at",
    )
    .eq("school_id", schoolId)
    .order("rank", { ascending: false });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, priorities: data ?? [] };
}

export async function upsertPriorityLevelAction(
  input: PriorityInput,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validatePriorityInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const payload = {
    school_id: schoolId,
    code: ensureCommCode(input.name, input.code, "PRI"),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    rank: input.rank ?? 0,
    bypass_quiet_hours: input.bypassQuietHours ?? false,
    display_order: input.displayOrder ?? 0,
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("comm_priority_levels")
      .update(payload)
      .eq("id", input.id)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return { success: false, error: error?.message ?? "Priority not found." };
    }
    revalidate();
    return { success: true, message: "Priority updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("comm_priority_levels")
    .insert({ ...payload, created_by: actorId })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create priority.",
    };
  }
  revalidate();
  return { success: true, message: "Priority created.", id: data.id };
}

export async function archivePriorityLevelAction(
  priorityId: string,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data, error } = await supabase
    .from("comm_priority_levels")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", priorityId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Priority not found." };
  }
  revalidate();
  return { success: true, message: "Priority archived.", id: data.id };
}
