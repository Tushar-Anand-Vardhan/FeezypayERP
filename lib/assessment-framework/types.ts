/** Assessment Framework Engine (E31) — shared types */

export const FRAMEWORK_STATUSES = ["draft", "published", "retired"] as const;
export type FrameworkStatus = (typeof FRAMEWORK_STATUSES)[number];

export const CATEGORY_KINDS = [
  "term_exam",
  "half_yearly",
  "final",
  "periodic_test",
  "notebook",
  "classwork",
  "practical",
  "project",
  "viva",
  "observation",
  "internal_assessment",
  "activity",
  "custom",
] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const CATEGORY_VISIBILITIES = [
  "internal",
  "teachers",
  "students",
  "parents",
  "all",
] as const;
export type CategoryVisibility = (typeof CATEGORY_VISIBILITIES)[number];

export const FORMULA_KINDS = ["weighted_sum", "custom"] as const;
export type FormulaKind = (typeof FORMULA_KINDS)[number];

/** Teachers never get these — admin/HOD only */
export const FRAMEWORK_WRITE_PERMISSIONS = [
  "assessment_framework.edit",
  "assessment_framework.publish",
  "assessment_framework.archive",
  "assessment_framework.clone",
] as const;

export type FrameworkActionResult =
  | { success: true; id?: string; versionId?: string; [key: string]: unknown }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type FrameworkInput = {
  academicYearId: string;
  classId: string;
  subjectId: string;
  code?: string;
  name: string;
  description?: string | null;
};

export type FrameworkCategoryInput = {
  frameworkId: string;
  name: string;
  code?: string | null;
  categoryKind?: CategoryKind;
  assessmentCategoryId?: string | null;
  description?: string | null;
  weightagePercent?: number | null;
  maxMarks?: number | null;
  passMarks?: number | null;
  gradeMapping?: Record<string, unknown> | null;
  gradingScaleVersionId?: string | null;
  includedInFinalGrade?: boolean;
  termId?: string | null;
  visibility?: CategoryVisibility;
  reportCardMapping?: Record<string, unknown> | null;
  displayOrder?: number;
};

export type FormulaPartInput = {
  categoryId: string;
  weightPercent: number;
  displayOrder?: number;
};

export type FrameworkFormulaInput = {
  frameworkId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  termId?: string | null;
  formulaKind?: FormulaKind;
  expression?: Record<string, unknown> | null;
  isFinalGrade?: boolean;
  displayOrder?: number;
  parts?: FormulaPartInput[];
};

export type CloneFrameworkInput = {
  sourceFrameworkId: string;
  targetAcademicYearId: string;
  targetClassId?: string | null;
  targetSubjectId?: string | null;
  name?: string;
  code?: string;
};

export type FrameworkSnapshot = {
  framework: Record<string, unknown>;
  categories: Array<Record<string, unknown>>;
  formulas: Array<Record<string, unknown>>;
  formulaParts: Array<Record<string, unknown>>;
};
