import { ensureSubjectCode } from "@/lib/config/codes";
import {
  SUBJECT_CATEGORIES,
  SUBJECT_DEPENDENCY_TYPES,
  type AssessmentRules,
  type SubjectDependencyInput,
  type SubjectGroupInput,
  type SubjectMasterInput,
} from "@/lib/subjects/types";

const LANG_CODE_RE = /^[a-z]{2,3}(-[A-Z]{2})?$/i;

export function trimSubjectGroupInput(input: SubjectGroupInput): SubjectGroupInput {
  return {
    id: input.id,
    name: input.name.trim(),
    code: input.code?.trim() ?? "",
    description: input.description?.trim() ?? "",
    displayOrder: input.displayOrder ?? 0,
  };
}

export function validateSubjectGroupInput(
  input: SubjectGroupInput,
): Record<string, string> {
  const trimmed = trimSubjectGroupInput(input);
  const errors: Record<string, string> = {};
  if (!trimmed.name) {
    errors.name = "Group name is required.";
  }
  return errors;
}

export function normalizeAssessmentRules(
  rules?: AssessmentRules,
): AssessmentRules {
  if (!rules) {
    return {};
  }
  return {
    gradingType: rules.gradingType,
    maxMarks: rules.maxMarks ?? null,
    passMarks: rules.passMarks ?? null,
    hasPractical: rules.hasPractical ?? false,
    practicalWeightage: rules.practicalWeightage ?? null,
    internalAssessment: rules.internalAssessment ?? false,
    internalMaxMarks: rules.internalMaxMarks ?? null,
  };
}

export function validateAssessmentRules(
  rules: AssessmentRules,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (
    rules.gradingType &&
    !["marks", "grade", "pass_fail"].includes(rules.gradingType)
  ) {
    errors.gradingType = "Invalid grading type.";
  }
  if (rules.maxMarks != null && (rules.maxMarks < 0 || rules.maxMarks > 1000)) {
    errors.maxMarks = "Max marks must be between 0 and 1000.";
  }
  if (rules.passMarks != null && (rules.passMarks < 0 || rules.passMarks > 1000)) {
    errors.passMarks = "Pass marks must be between 0 and 1000.";
  }
  if (
    rules.maxMarks != null &&
    rules.passMarks != null &&
    rules.passMarks > rules.maxMarks
  ) {
    errors.passMarks = "Pass marks cannot exceed max marks.";
  }
  if (
    rules.practicalWeightage != null &&
    (rules.practicalWeightage < 0 || rules.practicalWeightage > 100)
  ) {
    errors.practicalWeightage = "Practical weightage must be 0–100.";
  }
  return errors;
}

export function trimSubjectMasterInput(
  input: SubjectMasterInput,
): SubjectMasterInput {
  const category =
    input.category ??
    (input.isLanguage
      ? "language"
      : input.isElective
        ? "elective"
        : input.type === "co_scholastic"
          ? "co_scholastic"
          : "scholastic");

  const legacyType: "scholastic" | "co_scholastic" =
    category === "co_scholastic" ? "co_scholastic" : "scholastic";

  return {
    id: input.id,
    name: input.name.trim(),
    code: input.code?.trim() ?? "",
    description: input.description?.trim() ?? "",
    type: input.type ?? legacyType,
    category,
    subjectGroupId: input.subjectGroupId?.trim() || null,
    isLanguage: input.isLanguage ?? category === "language",
    languageCode: input.languageCode?.trim() || null,
    isElective: input.isElective ?? category === "elective",
    boardCode: input.boardCode?.trim() || null,
    boardSubjectName: input.boardSubjectName?.trim() || null,
    credits: input.credits ?? null,
    weeklyPeriods: input.weeklyPeriods ?? null,
    requiresLab: input.requiresLab ?? false,
    displayOrder: input.displayOrder ?? 0,
    assessmentRules: normalizeAssessmentRules(input.assessmentRules),
    textbookIsbn: input.textbookIsbn?.trim() || null,
    textbookTitle: input.textbookTitle?.trim() || null,
    aiLessonPlanEnabled: input.aiLessonPlanEnabled ?? false,
    chapterMap: Array.isArray(input.chapterMap) ? input.chapterMap : [],
  };
}

export function validateSubjectMasterInput(
  input: SubjectMasterInput,
): Record<string, string> {
  const trimmed = trimSubjectMasterInput(input);
  const errors: Record<string, string> = {};

  if (!trimmed.name) {
    errors.name = "Subject name is required.";
  }
  if (trimmed.category && !SUBJECT_CATEGORIES.includes(trimmed.category)) {
    errors.category = "Invalid category.";
  }
  if (trimmed.languageCode && !LANG_CODE_RE.test(trimmed.languageCode)) {
    errors.languageCode = "Use ISO language code (e.g. en, hi, en-IN).";
  }
  if (trimmed.credits != null && (trimmed.credits < 0 || trimmed.credits > 99.9)) {
    errors.credits = "Credits must be 0–99.9.";
  }
  if (
    trimmed.weeklyPeriods != null &&
    (trimmed.weeklyPeriods < 0 || trimmed.weeklyPeriods > 40)
  ) {
    errors.weeklyPeriods = "Weekly periods must be 0–40.";
  }

  const ruleErrors = validateAssessmentRules(trimmed.assessmentRules ?? {});
  for (const [k, v] of Object.entries(ruleErrors)) {
    errors[`assessmentRules.${k}`] = v;
  }

  if (trimmed.name) {
    ensureSubjectCode(trimmed.name, trimmed.code);
  }

  return errors;
}

export function validateSubjectDependencyInput(
  input: SubjectDependencyInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.subjectId?.trim()) {
    errors.subjectId = "Subject is required.";
  }
  if (!input.dependsOnSubjectId?.trim()) {
    errors.dependsOnSubjectId = "Depends-on subject is required.";
  }
  if (
    input.subjectId &&
    input.dependsOnSubjectId &&
    input.subjectId === input.dependsOnSubjectId
  ) {
    errors.dependsOnSubjectId = "A subject cannot depend on itself.";
  }
  const depType = input.dependencyType ?? "prerequisite";
  if (!SUBJECT_DEPENDENCY_TYPES.includes(depType)) {
    errors.dependencyType = "Invalid dependency type.";
  }
  return errors;
}
