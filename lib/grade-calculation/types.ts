/** Grade Calculation Engine (E33) — shared types */

export const RUN_SCOPES = ["subject", "term", "overall"] as const;
export type RunScope = (typeof RUN_SCOPES)[number];

export const RESULT_KINDS = ["subject", "term", "overall"] as const;
export type ResultKind = (typeof RESULT_KINDS)[number];

export const PASS_STATUSES = [
  "pass",
  "fail",
  "exempt",
  "incomplete",
] as const;
export type PassStatus = (typeof PASS_STATUSES)[number];

export const EXEMPTION_KINDS = [
  "absent_excused",
  "medical",
  "optional_subject",
  "custom",
] as const;
export type ExemptionKind = (typeof EXEMPTION_KINDS)[number];

export type GradeBand = {
  letter: string;
  minPercent: number;
  maxPercent: number;
  gradePoints?: number;
};

export type GraceRulesConfig = {
  maxGraceMarks?: number;
  /** Apply only when failing before grace */
  applyTo?: "failing_only" | "all";
  /** Do not raise above this percentage via grace */
  ceilingPercent?: number;
  passPercent?: number;
};

export type FormulaPartInput = {
  categoryId: string;
  weightPercent: number;
};

export type CategoryMarksInput = {
  categoryId: string;
  /** Average (or pre-aggregated) marks for student in this category, 0–maxMarks scale */
  obtained: number;
  maxMarks: number;
  markRowIds: string[];
  exempt?: boolean;
};

export type StudentSubjectCalcInput = {
  studentProfileId: string;
  subjectId: string;
  categories: CategoryMarksInput[];
  formulaParts: FormulaPartInput[];
  gradeBands: GradeBand[];
  grace?: GraceRulesConfig;
  subjectExempt?: boolean;
  passPercent?: number;
};

export type SubjectCalcOutput = {
  studentProfileId: string;
  subjectId: string;
  finalMarks: number;
  maxMarks: number;
  percentage: number;
  letterGrade: string | null;
  gradePoints: number | null;
  passStatus: PassStatus;
  graceApplied: number;
  breakdown: Record<string, unknown>;
};

export type GradeActionResult =
  | { success: true; id?: string; [key: string]: unknown }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type GraceRuleInput = {
  code?: string;
  name: string;
  description?: string | null;
  academicYearId?: string | null;
  rules: GraceRulesConfig;
};

export type OptionalSubjectInput = {
  academicYearId: string;
  classId: string;
  subjectId: string;
  includeInOverall?: boolean;
  weightOverridePercent?: number | null;
};

export type ExemptionInput = {
  academicYearId: string;
  studentProfileId: string;
  exemptionKind: ExemptionKind;
  subjectId?: string | null;
  frameworkCategoryId?: string | null;
  assessmentRecordId?: string | null;
  reason?: string | null;
};

export type RunCalcInput = {
  academicYearId: string;
  classId: string;
  sectionId?: string | null;
  subjectId?: string | null;
  termId?: string | null;
  assessmentFrameworkId: string;
  assessmentFrameworkVersionId: string;
  formulaId?: string | null;
  scope: RunScope;
  changeSummary?: string;
  /** Injected evidence for server action; also used in pure tests */
  students?: StudentSubjectCalcInput[];
  gradeBands?: GradeBand[];
  grace?: GraceRulesConfig;
};

export const TEACHER_CALC_PERMISSIONS = ["grade_calculation.read"] as const;
export const ADMIN_CALC_PERMISSIONS = [
  "grade_calculation.configure",
  "grade_calculation.run",
  "grade_calculation.publish",
] as const;
