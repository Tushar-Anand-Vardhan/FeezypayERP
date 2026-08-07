"use server";

import { revalidatePath } from "next/cache";
import { getActorId } from "@/lib/assessment/server-helpers";
import type {
  AssessmentActionResult,
  ExamTypeInput,
} from "@/lib/assessment/types";
import {
  ensureExamTypeCode,
  validateExamTypeInput,
} from "@/lib/assessment/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/assessments");
  revalidatePath("/onboarding", "layout");
}

export async function listExamTypesAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | {
      success: true;
      examTypes: Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        default_weightage_percent: number | null;
        default_max_marks: number | null;
        default_pass_marks: number | null;
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
  let query = supabase
    .from("assessment_exam_types")
    .select(
      "id, code, name, description, default_weightage_percent, default_max_marks, default_pass_marks, display_order, archived_at",
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

  return { success: true, examTypes: data ?? [] };
}

export async function upsertExamTypeAction(
  input: ExamTypeInput,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateExamTypeInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const code = ensureExamTypeCode(input.name, input.code);
  const payload = {
    school_id: schoolId,
    code,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    default_weightage_percent: input.defaultWeightagePercent ?? null,
    default_max_marks: input.defaultMaxMarks ?? null,
    default_pass_marks: input.defaultPassMarks ?? null,
    display_order: input.displayOrder ?? 0,
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("assessment_exam_types")
      .update(payload)
      .eq("id", input.id)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Exam type not found.",
      };
    }

    revalidate();
    return { success: true, message: "Exam type updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("assessment_exam_types")
    .insert({ ...payload, created_by: actorId })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create exam type.",
    };
  }

  revalidate();
  return { success: true, message: "Exam type created.", id: data.id };
}

export async function archiveExamTypeAction(
  examTypeId: string,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data, error } = await supabase
    .from("assessment_exam_types")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", examTypeId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Exam type not found.",
    };
  }

  revalidate();
  return { success: true, message: "Exam type archived.", id: data.id };
}

export async function restoreExamTypeAction(
  examTypeId: string,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data, error } = await supabase
    .from("assessment_exam_types")
    .update({
      archived_at: null,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", examTypeId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Exam type not found.",
    };
  }

  revalidate();
  return { success: true, message: "Exam type restored.", id: data.id };
}
