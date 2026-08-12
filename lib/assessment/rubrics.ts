/** Assessment rubrics (Wave 5) — multi-criteria beyond grading_type enum. */

export type AssessmentActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type RubricLevel = {
  label: string;
  score: number;
  descriptor?: string;
};

export type RubricCriterionInput = {
  id?: string;
  name: string;
  description?: string;
  maxScore?: number;
  weight?: number;
  displayOrder?: number;
  levels?: RubricLevel[];
};

export type RubricInput = {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  maxScore?: number | null;
  criteria?: RubricCriterionInput[];
};

export function ensureRubricCode(name: string, code?: string | null): string {
  const raw = (code?.trim() || name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
  return raw || "RUBRIC";
}

export function validateRubricInput(input: RubricInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) {
    errors.name = "Rubric name is required.";
  }
  for (const [i, c] of (input.criteria ?? []).entries()) {
    if (!c.name?.trim()) {
      errors[`criteria-${i}-name`] = "Criterion name is required.";
    }
    if (c.maxScore != null && c.maxScore <= 0) {
      errors[`criteria-${i}-maxScore`] = "Max score must be positive.";
    }
  }
  return errors;
}
