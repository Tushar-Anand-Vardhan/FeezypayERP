"use server";

import { revalidatePath } from "next/cache";
import {
  assertClassInSchool,
  assertExamDefinitionOwned,
  assertGradingScaleVersionOwned,
  assertSubjectOwned,
  isEditBlocked,
} from "@/lib/assessment/server-helpers";
import type {
  AssessmentActionResult,
  ExamSubjectScheduleInput,
} from "@/lib/assessment/types";
import { validateExamSubjectScheduleInput } from "@/lib/assessment/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/assessments");
  revalidatePath("/onboarding", "layout");
}

export async function listExamSubjectSchedulesAction(
  examDefinitionId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      schedules: Array<{
        id: string;
        exam_definition_id: string;
        subject_id: string;
        class_id: string;
        grading_type: string;
        max_marks: number | null;
        pass_marks: number | null;
        is_optional_subject: boolean;
        component_type: string | null;
        grading_scale_version_id: string | null;
        scheduled_at: string | null;
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
    .from("exam_subject_schedules")
    .select(
      "id, exam_definition_id, subject_id, class_id, grading_type, max_marks, pass_marks, is_optional_subject, component_type, grading_scale_version_id, scheduled_at, archived_at",
    )
    .eq("exam_definition_id", examDefinitionId)
    .order("created_at", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, schedules: data ?? [] };
}

export async function upsertExamSubjectScheduleAction(
  input: ExamSubjectScheduleInput,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateExamSubjectScheduleInput(input);
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

  if (!(await assertSubjectOwned(supabase, schoolId, input.subjectId))) {
    return { success: false, error: "Subject not found." };
  }
  if (!(await assertClassInSchool(supabase, schoolId, input.classId))) {
    return { success: false, error: "Class not found." };
  }
  if (input.gradingScaleVersionId) {
    if (
      !(await assertGradingScaleVersionOwned(
        supabase,
        schoolId,
        input.gradingScaleVersionId,
      ))
    ) {
      return { success: false, error: "Grading scale version not found." };
    }
  }

  const payload = {
    exam_definition_id: input.examDefinitionId,
    subject_id: input.subjectId,
    class_id: input.classId,
    grading_type: input.gradingType ?? "marks",
    max_marks: input.maxMarks ?? null,
    pass_marks: input.passMarks ?? null,
    is_optional_subject: input.isOptionalSubject ?? false,
    component_type: input.componentType ?? null,
    grading_scale_version_id: input.gradingScaleVersionId || null,
    scheduled_at: input.scheduledAt || null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("exam_subject_schedules")
      .update(payload)
      .eq("id", input.id)
      .eq("exam_definition_id", input.examDefinitionId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Schedule not found.",
      };
    }

    revalidate();
    return { success: true, message: "Schedule updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("exam_subject_schedules")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create schedule.",
    };
  }

  revalidate();
  return { success: true, message: "Schedule created.", id: data.id };
}

export async function archiveExamSubjectScheduleAction(
  scheduleId: string,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: row } = await supabase
    .from("exam_subject_schedules")
    .select("id, exam_definition_id")
    .eq("id", scheduleId)
    .is("archived_at", null)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Schedule not found." };
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
    .from("exam_subject_schedules")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Schedule archived.", id: scheduleId };
}
