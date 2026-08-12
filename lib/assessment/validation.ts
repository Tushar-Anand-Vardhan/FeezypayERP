import { slugCode } from "@/lib/config/codes";
import {
  ASSESSMENT_CATEGORY_KINDS,
  ASSESSMENT_COMPONENT_TYPES,
  LEGACY_EXAM_CATEGORIES,
  PUBLISHING_STATUSES,
  type AssessmentCategoryInput,
  type AssessmentComponentInput,
  type AssessmentPolicyInput,
  type ExamDefinitionInput,
  type ExamSubjectScheduleInput,
  type ExamTypeInput,
  type LockRules,
  type PublishRules,
} from "@/lib/assessment/types";

export function ensureExamTypeCode(name: string, code?: string | null): string {
  if (code && code.trim()) {
    return slugCode(code.trim(), "EXAM");
  }
  return slugCode(name, "EXAM");
}

export function ensureCategoryCode(name: string, code?: string | null): string {
  if (code && code.trim()) {
    return slugCode(code.trim(), "CAT");
  }
  return slugCode(name, "CAT");
}

export function normalizePublishRules(rules?: PublishRules): PublishRules {
  return {
    visibleToParents: rules?.visibleToParents ?? false,
    visibleToStudents: rules?.visibleToStudents ?? false,
    requireSchedules: rules?.requireSchedules ?? false,
    autoLockOnPublish: rules?.autoLockOnPublish ?? false,
  };
}

export function normalizeLockRules(rules?: LockRules): LockRules {
  return {
    lockOnPublish: rules?.lockOnPublish ?? true,
    preventEditWhenLocked: rules?.preventEditWhenLocked ?? true,
    preventArchiveWhenLocked: rules?.preventArchiveWhenLocked ?? true,
  };
}

export function publishRulesToJson(rules?: PublishRules): Record<string, unknown> {
  const r = normalizePublishRules(rules);
  return {
    visible_to_parents: r.visibleToParents,
    visible_to_students: r.visibleToStudents,
    require_schedules: r.requireSchedules,
    auto_lock_on_publish: r.autoLockOnPublish,
  };
}

export function lockRulesToJson(rules?: LockRules): Record<string, unknown> {
  const r = normalizeLockRules(rules);
  return {
    lock_on_publish: r.lockOnPublish,
    prevent_edit_when_locked: r.preventEditWhenLocked,
    prevent_archive_when_locked: r.preventArchiveWhenLocked,
  };
}

export function validateExamTypeInput(
  input: ExamTypeInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) {
    errors.name = "Exam type name is required.";
  }
  if (
    input.defaultWeightagePercent != null &&
    (input.defaultWeightagePercent < 0 || input.defaultWeightagePercent > 100)
  ) {
    errors.defaultWeightagePercent = "Weightage must be between 0 and 100.";
  }
  if (input.defaultMaxMarks != null && input.defaultMaxMarks <= 0) {
    errors.defaultMaxMarks = "Max marks must be positive.";
  }
  if (input.defaultPassMarks != null && input.defaultPassMarks < 0) {
    errors.defaultPassMarks = "Pass marks cannot be negative.";
  }
  if (
    input.defaultMaxMarks != null &&
    input.defaultPassMarks != null &&
    input.defaultPassMarks > input.defaultMaxMarks
  ) {
    errors.defaultPassMarks = "Pass marks cannot exceed max marks.";
  }
  return errors;
}

export function validateAssessmentCategoryInput(
  input: AssessmentCategoryInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) {
    errors.name = "Category name is required.";
  }
  if (!ASSESSMENT_CATEGORY_KINDS.includes(input.kind)) {
    errors.kind = "Invalid category kind.";
  }
  return errors;
}

export function validateAssessmentPolicyInput(
  input: AssessmentPolicyInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const pass = input.defaultPassPercent ?? 33;
  if (pass < 0 || pass > 100) {
    errors.defaultPassPercent = "Pass percent must be 0–100.";
  }
  return errors;
}

export function validateExamDefinitionInput(
  input: ExamDefinitionInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!input.name?.trim()) {
    errors.name = "Assessment name is required.";
  }
  if (
    input.category &&
    !LEGACY_EXAM_CATEGORIES.includes(
      input.category as (typeof LEGACY_EXAM_CATEGORIES)[number],
    )
  ) {
    errors.category = "Invalid category.";
  }
  if (
    input.weightagePercent != null &&
    (input.weightagePercent < 0 || input.weightagePercent > 100)
  ) {
    errors.weightagePercent = "Weightage must be between 0 and 100.";
  }
  if (input.maxMarks != null && input.maxMarks <= 0) {
    errors.maxMarks = "Max marks must be positive.";
  }
  if (input.passMarks != null && input.passMarks < 0) {
    errors.passMarks = "Pass marks cannot be negative.";
  }
  if (
    input.maxMarks != null &&
    input.passMarks != null &&
    input.passMarks > input.maxMarks
  ) {
    errors.passMarks = "Pass marks cannot exceed max marks.";
  }
  if (
    input.publishingStatus &&
    !PUBLISHING_STATUSES.includes(input.publishingStatus)
  ) {
    errors.publishingStatus = "Invalid publishing status.";
  }
  if (
    input.gradingType &&
    !["marks", "letter_grade", "rubric"].includes(input.gradingType)
  ) {
    errors.gradingType = "Invalid grading type.";
  }
  return errors;
}

export function validateAssessmentComponentInput(
  input: AssessmentComponentInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.examDefinitionId?.trim()) {
    errors.examDefinitionId = "Exam definition is required.";
  }
  if (!input.name?.trim()) {
    errors.name = "Component name is required.";
  }
  if (!ASSESSMENT_COMPONENT_TYPES.includes(input.componentType)) {
    errors.componentType = "Invalid component type.";
  }
  if (
    input.weightagePercent != null &&
    (input.weightagePercent < 0 || input.weightagePercent > 100)
  ) {
    errors.weightagePercent = "Weightage must be between 0 and 100.";
  }
  if (input.maxMarks != null && input.maxMarks <= 0) {
    errors.maxMarks = "Max marks must be positive.";
  }
  if (
    input.maxMarks != null &&
    input.passMarks != null &&
    input.passMarks > input.maxMarks
  ) {
    errors.passMarks = "Pass marks cannot exceed max marks.";
  }
  return errors;
}

export function validateExamSubjectScheduleInput(
  input: ExamSubjectScheduleInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.examDefinitionId?.trim()) {
    errors.examDefinitionId = "Exam definition is required.";
  }
  if (!input.subjectId?.trim()) {
    errors.subjectId = "Subject is required.";
  }
  if (!input.classId?.trim()) {
    errors.classId = "Class is required.";
  }
  if (input.maxMarks != null && input.maxMarks <= 0) {
    errors.maxMarks = "Max marks must be positive.";
  }
  if (
    input.maxMarks != null &&
    input.passMarks != null &&
    input.passMarks > input.maxMarks
  ) {
    errors.passMarks = "Pass marks cannot exceed max marks.";
  }
  if (
    input.componentType &&
    !ASSESSMENT_COMPONENT_TYPES.includes(input.componentType)
  ) {
    errors.componentType = "Invalid component type.";
  }
  if (
    input.dayKind &&
    input.dayKind !== "half_day" &&
    input.dayKind !== "full_day"
  ) {
    errors.dayKind = "Day kind must be half_day or full_day.";
  }
  const starts = input.startsAt || input.scheduledAt;
  const ends = input.endsAt;
  if (starts && ends && new Date(ends).getTime() < new Date(starts).getTime()) {
    errors.endsAt = "End must be on or after start.";
  }
  const opens = input.markingOpensAt;
  const closes = input.markingClosesAt;
  if (
    opens &&
    closes &&
    new Date(closes).getTime() < new Date(opens).getTime()
  ) {
    errors.markingClosesAt = "Marking close must be on or after open.";
  }
  if (input.gradingType === "rubric" && !input.rubricId?.trim()) {
    errors.rubricId = "Select a rubric when grading type is rubric.";
  }
  return errors;
}

export function publishRulesFromJson(raw: unknown): PublishRules {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const o = raw as Record<string, unknown>;
  return {
    visibleToParents: Boolean(o.visible_to_parents),
    visibleToStudents: Boolean(o.visible_to_students),
    requireSchedules: Boolean(o.require_schedules),
    autoLockOnPublish: Boolean(o.auto_lock_on_publish),
  };
}

export function lockRulesFromJson(raw: unknown): LockRules {
  if (!raw || typeof raw !== "object") {
    return {
      lockOnPublish: true,
      preventEditWhenLocked: true,
      preventArchiveWhenLocked: true,
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    lockOnPublish:
      o.lock_on_publish === undefined ? true : Boolean(o.lock_on_publish),
    preventEditWhenLocked:
      o.prevent_edit_when_locked === undefined
        ? true
        : Boolean(o.prevent_edit_when_locked),
    preventArchiveWhenLocked:
      o.prevent_archive_when_locked === undefined
        ? true
        : Boolean(o.prevent_archive_when_locked),
  };
}

export function isEditBlocked(
  publishingStatus: string | undefined,
  lockRules: LockRules | undefined,
): boolean {
  if (publishingStatus !== "locked") {
    return false;
  }
  return lockRules?.preventEditWhenLocked !== false;
}

export function isArchiveBlocked(
  publishingStatus: string | undefined,
  lockRules: LockRules | undefined,
): boolean {
  if (publishingStatus !== "locked") {
    return false;
  }
  return lockRules?.preventArchiveWhenLocked !== false;
}
