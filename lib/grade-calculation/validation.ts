import type {
  ExemptionInput,
  GraceRuleInput,
  OptionalSubjectInput,
  RunCalcInput,
} from "@/lib/grade-calculation/types";
import { RUN_SCOPES } from "@/lib/grade-calculation/types";
import { ADMIN_CALC_PERMISSIONS } from "@/lib/grade-calculation/types";

export function validateGraceRuleInput(
  input: GraceRuleInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) errors.name = "Required";
  if (
    input.rules.maxGraceMarks != null &&
    input.rules.maxGraceMarks < 0
  ) {
    errors.maxGraceMarks = "Must be ≥ 0";
  }
  return errors;
}

export function validateOptionalSubjectInput(
  input: OptionalSubjectInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.academicYearId?.trim()) errors.academicYearId = "Required";
  if (!input.classId?.trim()) errors.classId = "Required";
  if (!input.subjectId?.trim()) errors.subjectId = "Required";
  return errors;
}

export function validateExemptionInput(
  input: ExemptionInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.academicYearId?.trim()) errors.academicYearId = "Required";
  if (!input.studentProfileId?.trim()) errors.studentProfileId = "Required";
  if (!input.exemptionKind) errors.exemptionKind = "Required";
  return errors;
}

export function validateRunCalcInput(
  input: RunCalcInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.academicYearId?.trim()) errors.academicYearId = "Required";
  if (!input.classId?.trim()) errors.classId = "Required";
  if (!input.assessmentFrameworkId?.trim()) {
    errors.assessmentFrameworkId = "Required";
  }
  if (!input.assessmentFrameworkVersionId?.trim()) {
    errors.assessmentFrameworkVersionId = "Required";
  }
  if (!(RUN_SCOPES as readonly string[]).includes(input.scope)) {
    errors.scope = "Invalid scope";
  }
  if (input.scope === "subject" && !input.subjectId?.trim()) {
    errors.subjectId = "Required for subject scope";
  }
  return errors;
}

export function teachersCannotRunCalculations(): boolean {
  return true;
}

export function adminCalcPermissionKeys(): readonly string[] {
  return ADMIN_CALC_PERMISSIONS;
}

export function isAdminCalcPermission(key: string): boolean {
  return (ADMIN_CALC_PERMISSIONS as readonly string[]).includes(key);
}
