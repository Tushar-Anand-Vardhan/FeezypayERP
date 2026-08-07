import type {
  CloneFrameworkInput,
  FrameworkCategoryInput,
  FrameworkFormulaInput,
  FrameworkInput,
  FormulaPartInput,
} from "@/lib/assessment-framework/types";
import {
  CATEGORY_KINDS,
  CATEGORY_VISIBILITIES,
  FRAMEWORK_WRITE_PERMISSIONS,
} from "@/lib/assessment-framework/types";

export function validateFrameworkInput(
  input: FrameworkInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.academicYearId?.trim()) errors.academicYearId = "Required";
  if (!input.classId?.trim()) errors.classId = "Required";
  if (!input.subjectId?.trim()) errors.subjectId = "Required";
  if (!input.name?.trim()) errors.name = "Required";
  return errors;
}

export function validateCategoryInput(
  input: FrameworkCategoryInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.frameworkId?.trim()) errors.frameworkId = "Required";
  if (!input.name?.trim()) errors.name = "Required";
  if (
    input.categoryKind &&
    !(CATEGORY_KINDS as readonly string[]).includes(input.categoryKind)
  ) {
    errors.categoryKind = "Invalid kind";
  }
  if (
    input.weightagePercent != null &&
    (input.weightagePercent < 0 || input.weightagePercent > 100)
  ) {
    errors.weightagePercent = "Must be 0–100";
  }
  if (input.maxMarks != null && input.maxMarks <= 0) {
    errors.maxMarks = "Must be > 0";
  }
  if (
    input.passMarks != null &&
    input.maxMarks != null &&
    input.passMarks > input.maxMarks
  ) {
    errors.passMarks = "Must be ≤ max marks";
  }
  if (
    input.visibility &&
    !(CATEGORY_VISIBILITIES as readonly string[]).includes(input.visibility)
  ) {
    errors.visibility = "Invalid visibility";
  }
  return errors;
}

export function validateFormulaParts(
  parts: FormulaPartInput[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!parts.length) {
    errors.parts = "At least one part required for weighted_sum";
    return errors;
  }
  let sum = 0;
  for (const p of parts) {
    if (!p.categoryId?.trim()) {
      errors.parts = "Each part needs categoryId";
      return errors;
    }
    if (p.weightPercent < 0 || p.weightPercent > 100) {
      errors.parts = "Weight must be 0–100";
      return errors;
    }
    sum += p.weightPercent;
  }
  if (Math.abs(sum - 100) > 0.01) {
    errors.parts = `Weights must sum to 100 (got ${sum})`;
  }
  return errors;
}

export function validateFormulaInput(
  input: FrameworkFormulaInput,
  requireParts = true,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.frameworkId?.trim()) errors.frameworkId = "Required";
  if (!input.name?.trim()) errors.name = "Required";
  if (
    requireParts &&
    (input.formulaKind ?? "weighted_sum") === "weighted_sum" &&
    input.parts
  ) {
    Object.assign(errors, validateFormulaParts(input.parts));
  }
  return errors;
}

export function validateCloneFrameworkInput(
  input: CloneFrameworkInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.sourceFrameworkId?.trim()) {
    errors.sourceFrameworkId = "Required";
  }
  if (!input.targetAcademicYearId?.trim()) {
    errors.targetAcademicYearId = "Required";
  }
  return errors;
}

/** Example Term 1 blend shape for smokes / docs */
export function exampleTerm1FormulaParts(): FormulaPartInput[] {
  return [
    { categoryId: "classwork", weightPercent: 50 },
    { categoryId: "periodic", weightPercent: 30 },
    { categoryId: "practical", weightPercent: 20 },
  ];
}

export function frameworkWritePermissionKeys(): readonly string[] {
  return FRAMEWORK_WRITE_PERMISSIONS;
}

export function isFrameworkWritePermission(key: string): boolean {
  return (FRAMEWORK_WRITE_PERMISSIONS as readonly string[]).includes(key);
}
