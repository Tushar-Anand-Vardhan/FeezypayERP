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
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/teacher/marks");
  revalidatePath("/onboarding", "layout");
}

const SCHEDULE_SELECT =
  "id, exam_definition_id, subject_id, class_id, section_id, grading_type, max_marks, pass_marks, is_optional_subject, component_type, grading_scale_version_id, rubric_id, scheduled_at, starts_at, ends_at, marking_opens_at, marking_closes_at, day_kind, period_id, archived_at";

async function assertSectionInClass(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  classId: string,
  sectionId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("sections")
    .select("id")
    .eq("id", sectionId)
    .eq("class_id", classId)
    .maybeSingle();
  return Boolean(data);
}

export async function listExamSubjectSchedulesAction(
  examDefinitionId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      schedules: Array<Record<string, unknown>>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("assessment.config.read");
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
    .select(SCHEDULE_SELECT)
    .eq("exam_definition_id", examDefinitionId)
    .order("starts_at", { ascending: true, nullsFirst: false });

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
  if (input.sectionId) {
    if (
      !(await assertSectionInClass(supabase, input.classId, input.sectionId))
    ) {
      return { success: false, error: "Section not found for this class." };
    }
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
  if (input.rubricId) {
    const { data: rubric } = await supabase
      .from("assessment_rubrics")
      .select("id")
      .eq("id", input.rubricId)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .maybeSingle();
    if (!rubric) {
      return { success: false, error: "Rubric not found." };
    }
  }
  if (input.periodId) {
    const { data: period } = await supabase
      .from("period_definitions")
      .select("id, academic_years!inner(school_id)")
      .eq("id", input.periodId)
      .maybeSingle();
    const years = period?.academic_years as
      | { school_id?: string }
      | { school_id?: string }[]
      | null;
    const school =
      Array.isArray(years) ? years[0]?.school_id : years?.school_id;
    if (!period || school !== schoolId) {
      return { success: false, error: "Period not found." };
    }
  }

  const startsAt = input.startsAt || input.scheduledAt || null;
  const payload = {
    exam_definition_id: input.examDefinitionId,
    subject_id: input.subjectId,
    class_id: input.classId,
    section_id: input.sectionId || null,
    grading_type: input.gradingType ?? "marks",
    max_marks: input.maxMarks ?? null,
    pass_marks: input.passMarks ?? null,
    is_optional_subject: input.isOptionalSubject ?? false,
    component_type: input.componentType ?? null,
    grading_scale_version_id: input.gradingScaleVersionId || null,
    rubric_id: input.rubricId || null,
    scheduled_at: startsAt,
    starts_at: startsAt,
    ends_at: input.endsAt || null,
    marking_opens_at: input.markingOpensAt || null,
    marking_closes_at: input.markingClosesAt || null,
    day_kind: input.dayKind || null,
    period_id: input.periodId || null,
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
