"use server";

import { revalidatePath } from "next/cache";
import {
  assertCategoryOwned,
  assertExamDefinitionOwned,
  assertExamTypeOwned,
  assertGradingScaleVersionOwned,
  assertSubjectGroupOwned,
  assertTermInYear,
  assertYearOwned,
  getActorId,
  isArchiveBlocked,
  isEditBlocked,
} from "@/lib/assessment/server-helpers";
import type {
  AssessmentActionResult,
  ExamDefinitionInput,
  PublishingStatus,
} from "@/lib/assessment/types";
import {
  lockRulesFromJson,
  lockRulesToJson,
  publishRulesFromJson,
  publishRulesToJson,
  validateExamDefinitionInput,
} from "@/lib/assessment/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/assessments");
  revalidatePath("/onboarding", "layout");
}

const EXAM_SELECT =
  "id, academic_year_id, term_id, name, category, exam_type_id, assessment_category_id, weightage_percent, max_marks, pass_marks, grading_type, grading_scale_version_id, subject_group_id, includes_optional_subjects, description, publishing_status, publish_at, published_at, locked_at, publish_rules, lock_rules, moderation_enabled, ai_evaluation_enabled, archived_at";

export async function listExamDefinitionsAction(
  academicYearId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      exams: Array<Record<string, unknown>>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  let query = supabase
    .from("exam_definitions")
    .select(EXAM_SELECT)
    .eq("academic_year_id", academicYearId)
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, exams: data ?? [] };
}

export async function upsertExamDefinitionAction(
  input: ExamDefinitionInput,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateExamDefinitionInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const academicYearId = input.academicYearId.trim();
  if (!(await assertYearOwned(supabase, schoolId, academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  if (input.termId) {
    if (!(await assertTermInYear(supabase, academicYearId, input.termId))) {
      return { success: false, error: "Term not found in this year." };
    }
  }

  if (input.examTypeId) {
    if (!(await assertExamTypeOwned(supabase, schoolId, input.examTypeId))) {
      return { success: false, error: "Exam type not found." };
    }
  }

  if (input.assessmentCategoryId) {
    if (
      !(await assertCategoryOwned(supabase, schoolId, input.assessmentCategoryId))
    ) {
      return { success: false, error: "Assessment category not found." };
    }
  }

  if (input.subjectGroupId) {
    if (
      !(await assertSubjectGroupOwned(supabase, schoolId, input.subjectGroupId))
    ) {
      return { success: false, error: "Subject group not found." };
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

  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();

  if (input.id) {
    const owned = await assertExamDefinitionOwned(
      supabase,
      schoolId,
      input.id,
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
  }

  const payload = {
    academic_year_id: academicYearId,
    term_id: input.termId || null,
    name: input.name.trim(),
    category: input.category ?? "other",
    exam_type_id: input.examTypeId || null,
    assessment_category_id: input.assessmentCategoryId || null,
    weightage_percent: input.weightagePercent ?? null,
    max_marks: input.maxMarks ?? null,
    pass_marks: input.passMarks ?? null,
    grading_type: input.gradingType ?? "marks",
    grading_scale_version_id: input.gradingScaleVersionId || null,
    subject_group_id: input.subjectGroupId || null,
    includes_optional_subjects: input.includesOptionalSubjects ?? false,
    description: input.description?.trim() || null,
    publish_rules: publishRulesToJson(input.publishRules),
    lock_rules: lockRulesToJson(input.lockRules),
    moderation_enabled: input.moderationEnabled ?? false,
    ai_evaluation_enabled: input.aiEvaluationEnabled ?? false,
    updated_by: actorId,
    updated_at: now,
  };

  if (input.id) {
    const statusUpdate: Record<string, unknown> = {};
    if (
      input.publishingStatus &&
      input.publishingStatus !== "locked" &&
      input.publishingStatus !== "published"
    ) {
      statusUpdate.publishing_status = input.publishingStatus;
      if (input.publishingStatus === "scheduled") {
        statusUpdate.publish_at = input.publishAt || null;
      }
    }

    const { data, error } = await supabase
      .from("exam_definitions")
      .update({ ...payload, ...statusUpdate })
      .eq("id", input.id)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Could not update assessment.",
      };
    }

    revalidate();
    return { success: true, message: "Assessment updated.", id: data.id };
  }

  const publishingStatus: PublishingStatus =
    input.publishingStatus === "scheduled" ? "scheduled" : "draft";

  const { data, error } = await supabase
    .from("exam_definitions")
    .insert({
      ...payload,
      publishing_status: publishingStatus,
      publish_at:
        publishingStatus === "scheduled" ? input.publishAt || null : null,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create assessment.",
    };
  }

  revalidate();
  return { success: true, message: "Assessment created.", id: data.id };
}

export async function publishExamDefinitionAction(
  examDefinitionId: string,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertExamDefinitionOwned(
    supabase,
    schoolId,
    examDefinitionId,
  );
  if (!owned.ok) {
    return { success: false, error: "Assessment not found." };
  }
  if (owned.publishingStatus === "locked") {
    return { success: false, error: "Assessment is already locked." };
  }

  const { data: exam } = await supabase
    .from("exam_definitions")
    .select("id, publish_rules, lock_rules")
    .eq("id", examDefinitionId)
    .maybeSingle();

  if (!exam) {
    return { success: false, error: "Assessment not found." };
  }

  const publishRules = publishRulesFromJson(exam.publish_rules);
  const lockRules = lockRulesFromJson(exam.lock_rules);
  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();

  if (publishRules.requireSchedules) {
    const { count } = await supabase
      .from("exam_subject_schedules")
      .select("id", { count: "exact", head: true })
      .eq("exam_definition_id", examDefinitionId)
      .is("archived_at", null);
    if ((count ?? 0) === 0) {
      return {
        success: false,
        error: "Publish requires at least one subject schedule.",
      };
    }
  }

  const shouldLock =
    publishRules.autoLockOnPublish === true ||
    lockRules.lockOnPublish !== false;

  const { error } = await supabase
    .from("exam_definitions")
    .update({
      publishing_status: shouldLock ? "locked" : "published",
      published_at: now,
      locked_at: shouldLock ? now : null,
      locked_by: shouldLock ? actorId : null,
      updated_by: actorId,
      updated_at: now,
    })
    .eq("id", examDefinitionId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return {
    success: true,
    message: shouldLock
      ? "Assessment published and locked."
      : "Assessment published.",
    id: examDefinitionId,
  };
}

export async function lockExamDefinitionAction(
  examDefinitionId: string,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertExamDefinitionOwned(
    supabase,
    schoolId,
    examDefinitionId,
  );
  if (!owned.ok) {
    return { success: false, error: "Assessment not found." };
  }

  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("exam_definitions")
    .update({
      publishing_status: "locked",
      locked_at: now,
      locked_by: actorId,
      updated_by: actorId,
      updated_at: now,
    })
    .eq("id", examDefinitionId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Assessment locked.", id: examDefinitionId };
}

export async function unlockExamDefinitionAction(
  examDefinitionId: string,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertExamDefinitionOwned(
    supabase,
    schoolId,
    examDefinitionId,
  );
  if (!owned.ok) {
    return { success: false, error: "Assessment not found." };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("exam_definitions")
    .update({
      publishing_status: "published",
      locked_at: null,
      locked_by: null,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", examDefinitionId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return {
    success: true,
    message: "Assessment unlocked.",
    id: examDefinitionId,
  };
}

export async function retractExamDefinitionAction(
  examDefinitionId: string,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertExamDefinitionOwned(
    supabase,
    schoolId,
    examDefinitionId,
  );
  if (!owned.ok) {
    return { success: false, error: "Assessment not found." };
  }
  if (isEditBlocked(owned.publishingStatus, owned.lockRules)) {
    return {
      success: false,
      error: "Unlock the assessment before retracting.",
    };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("exam_definitions")
    .update({
      publishing_status: "retracted",
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", examDefinitionId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return {
    success: true,
    message: "Assessment retracted.",
    id: examDefinitionId,
  };
}

export async function archiveExamDefinitionAction(
  examDefinitionId: string,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertExamDefinitionOwned(
    supabase,
    schoolId,
    examDefinitionId,
  );
  if (!owned.ok) {
    return { success: false, error: "Assessment not found." };
  }
  if (isArchiveBlocked(owned.publishingStatus, owned.lockRules)) {
    return {
      success: false,
      error: "Assessment is locked and cannot be archived.",
    };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("exam_definitions")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", examDefinitionId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return {
    success: true,
    message: "Assessment archived.",
    id: examDefinitionId,
  };
}

export async function restoreExamDefinitionAction(
  examDefinitionId: string,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext();
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

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("exam_definitions")
    .update({
      archived_at: null,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", examDefinitionId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return {
    success: true,
    message: "Assessment restored.",
    id: examDefinitionId,
  };
}
