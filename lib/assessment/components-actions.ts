"use server";

import { revalidatePath } from "next/cache";
import {
  assertExamDefinitionOwned,
  getActorId,
  isEditBlocked,
} from "@/lib/assessment/server-helpers";
import type {
  AssessmentActionResult,
  AssessmentComponentInput,
} from "@/lib/assessment/types";
import { validateAssessmentComponentInput } from "@/lib/assessment/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/assessments");
  revalidatePath("/onboarding", "layout");
}

export async function listAssessmentComponentsAction(
  examDefinitionId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      components: Array<{
        id: string;
        exam_definition_id: string;
        component_type: string;
        name: string;
        weightage_percent: number | null;
        max_marks: number | null;
        pass_marks: number | null;
        is_optional: boolean;
        display_order: number;
        archived_at: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("assessment.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertExamDefinitionOwned(
    supabase,
    schoolId,
    examDefinitionId,
    { allowArchived: true },
  );
  if (!owned.ok) {
    return { success: false, error: "Assessment not found." };
  }

  let query = supabase
    .from("assessment_components")
    .select(
      "id, exam_definition_id, component_type, name, weightage_percent, max_marks, pass_marks, is_optional, display_order, archived_at",
    )
    .eq("exam_definition_id", examDefinitionId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, components: data ?? [] };
}

export async function upsertAssessmentComponentAction(
  input: AssessmentComponentInput,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateAssessmentComponentInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const owned = await assertExamDefinitionOwned(
    supabase,
    schoolId,
    input.examDefinitionId,
  );
  if (!owned.ok) {
    return { success: false, error: "Assessment not found." };
  }
  if (isEditBlocked(owned.publishingStatus, owned.lockRules)) {
    return {
      success: false,
      error: "Assessment is locked and cannot be edited.",
    };
  }

  const actorId = await getActorId(supabase);
  const payload = {
    exam_definition_id: input.examDefinitionId,
    component_type: input.componentType,
    name: input.name.trim(),
    weightage_percent: input.weightagePercent ?? null,
    max_marks: input.maxMarks ?? null,
    pass_marks: input.passMarks ?? null,
    is_optional: input.isOptional ?? false,
    display_order: input.displayOrder ?? 0,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("assessment_components")
      .update(payload)
      .eq("id", input.id)
      .eq("exam_definition_id", input.examDefinitionId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Component not found.",
      };
    }

    revalidate();
    return { success: true, message: "Component updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("assessment_components")
    .insert({ ...payload, created_by: actorId })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create component.",
    };
  }

  revalidate();
  return { success: true, message: "Component created.", id: data.id };
}

export async function archiveAssessmentComponentAction(
  componentId: string,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: row } = await supabase
    .from("assessment_components")
    .select("id, exam_definition_id")
    .eq("id", componentId)
    .is("archived_at", null)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Component not found." };
  }

  const owned = await assertExamDefinitionOwned(
    supabase,
    schoolId,
    row.exam_definition_id,
  );
  if (!owned.ok) {
    return { success: false, error: "Assessment not found." };
  }
  if (isEditBlocked(owned.publishingStatus, owned.lockRules)) {
    return {
      success: false,
      error: "Assessment is locked and cannot be edited.",
    };
  }

  const { error } = await supabase
    .from("assessment_components")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", componentId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Component archived.", id: componentId };
}
