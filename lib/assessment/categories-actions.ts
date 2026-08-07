"use server";

import { revalidatePath } from "next/cache";
import { getActorId } from "@/lib/assessment/server-helpers";
import type {
  AssessmentActionResult,
  AssessmentCategoryInput,
} from "@/lib/assessment/types";
import {
  ensureCategoryCode,
  validateAssessmentCategoryInput,
} from "@/lib/assessment/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/assessments");
  revalidatePath("/onboarding", "layout");
}

export async function listAssessmentCategoriesAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | {
      success: true;
      categories: Array<{
        id: string;
        code: string;
        name: string;
        kind: string;
        description: string | null;
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
    .from("assessment_categories")
    .select(
      "id, code, name, kind, description, display_order, archived_at",
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

export async function upsertAssessmentCategoryAction(
  input: AssessmentCategoryInput,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateAssessmentCategoryInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const code = ensureCategoryCode(input.name, input.code);
  const payload = {
    school_id: schoolId,
    code,
    name: input.name.trim(),
    kind: input.kind,
    description: input.description?.trim() || null,
    display_order: input.displayOrder ?? 0,
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("assessment_categories")
      .update(payload)
      .eq("id", input.id)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Category not found.",
      };
    }

    revalidate();
    return { success: true, message: "Category updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("assessment_categories")
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

export async function archiveAssessmentCategoryAction(
  categoryId: string,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data, error } = await supabase
    .from("assessment_categories")
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
    return {
      success: false,
      error: error?.message ?? "Category not found.",
    };
  }

  revalidate();
  return { success: true, message: "Category archived.", id: data.id };
}

export async function restoreAssessmentCategoryAction(
  categoryId: string,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data, error } = await supabase
    .from("assessment_categories")
    .update({
      archived_at: null,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", categoryId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Category not found.",
    };
  }

  revalidate();
  return { success: true, message: "Category restored.", id: data.id };
}
