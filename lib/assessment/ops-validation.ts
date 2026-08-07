import type {
  AssessmentOperationalKind,
  BulkMarksInput,
  CorrectMarkInput,
  SingleMarkInput,
  TeacherAssessmentInput,
} from "@/lib/assessment/ops-types";
import { ASSESSMENT_OPERATIONAL_KINDS } from "@/lib/assessment/ops-types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

export function validateOperationalKind(
  kind: string,
): kind is AssessmentOperationalKind {
  return (ASSESSMENT_OPERATIONAL_KINDS as string[]).includes(kind);
}

export function teacherMayEditMarks(
  status: string,
  lockedAt: string | null,
): boolean {
  if (lockedAt) return false;
  return status === "draft" || status === "published";
}

/** Publish or lock → visible to parents/students. */
export function visibilityForMarksWorkflow(status: string): {
  visible_to_guardians: boolean;
  visible_to_students: boolean;
} {
  const open = status === "published" || status === "locked";
  return {
    visible_to_guardians: open,
    visible_to_students: open,
  };
}

function validateMarksPair(
  marksObtained: number | null | undefined,
  maxMarks: number | null | undefined,
  isAbsent: boolean | undefined,
  prefix: string,
  errors: Record<string, string>,
) {
  if (isAbsent) return;
  if (marksObtained == null && !errors[`${prefix}marksObtained`]) {
    // allow null only when absent; otherwise require a number
    errors[`${prefix}marksObtained`] = "Marks are required (or mark absent).";
  }
  if (marksObtained != null && Number.isNaN(Number(marksObtained))) {
    errors[`${prefix}marksObtained`] = "Marks must be a number.";
  }
  if (marksObtained != null && Number(marksObtained) < 0) {
    errors[`${prefix}marksObtained`] = "Marks cannot be negative.";
  }
  if (maxMarks != null && Number(maxMarks) <= 0) {
    errors[`${prefix}maxMarks`] = "Max marks must be positive.";
  }
  if (
    marksObtained != null &&
    maxMarks != null &&
    Number(marksObtained) > Number(maxMarks)
  ) {
    errors[`${prefix}marksObtained`] = "Marks cannot exceed max marks.";
  }
}

export function validateTeacherAssessmentInput(
  input: TeacherAssessmentInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!input.name?.trim()) {
    errors.name = "Name is required.";
  }
  if (!validateOperationalKind(input.operationalKind)) {
    errors.operationalKind = "Invalid assessment kind.";
  }
  if (!input.subjectId?.trim()) {
    errors.subjectId = "Subject is required.";
  }
  if (!input.classId?.trim()) {
    errors.classId = "Class is required.";
  }
  if (!(input.maxMarks > 0)) {
    errors.maxMarks = "Max marks must be positive.";
  }
  if (
    input.passMarks != null &&
    input.maxMarks > 0 &&
    input.passMarks > input.maxMarks
  ) {
    errors.passMarks = "Pass marks cannot exceed max marks.";
  }
  if (input.assessedOn && !isValidDate(input.assessedOn)) {
    errors.assessedOn = "Assessed date is invalid.";
  }
  if (input.dueOn && !isValidDate(input.dueOn)) {
    errors.dueOn = "Due date is invalid.";
  }
  return errors;
}

export function validateSingleMarkInput(
  input: SingleMarkInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.examDefinitionId?.trim()) {
    errors.examDefinitionId = "Assessment is required.";
  }
  if (!input.subjectId?.trim()) {
    errors.subjectId = "Subject is required.";
  }
  if (!input.studentProfileId?.trim()) {
    errors.studentProfileId = "Student is required.";
  }
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  validateMarksPair(
    input.marksObtained,
    input.maxMarks,
    input.isAbsent,
    "",
    errors,
  );
  if (input.teacherRemark && input.teacherRemark.length > 2000) {
    errors.teacherRemark = "Remark is too long.";
  }
  return errors;
}

export function validateBulkMarksInput(
  input: BulkMarksInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.examDefinitionId?.trim()) {
    errors.examDefinitionId = "Assessment is required.";
  }
  if (!input.subjectId?.trim()) {
    errors.subjectId = "Subject is required.";
  }
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!input.marks?.length) {
    errors.marks = "At least one mark is required.";
  } else {
    input.marks.forEach((m, i) => {
      if (!m.studentProfileId?.trim()) {
        errors[`marks.${i}.studentProfileId`] = "Student is required.";
      }
      validateMarksPair(
        m.marksObtained,
        m.maxMarks ?? input.defaultMaxMarks,
        m.isAbsent,
        `marks.${i}.`,
        errors,
      );
      if (m.teacherRemark && m.teacherRemark.length > 2000) {
        errors[`marks.${i}.teacherRemark`] = "Remark is too long.";
      }
    });
  }
  return errors;
}

export function validateCorrectMarkInput(
  input: CorrectMarkInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.examResultId?.trim()) {
    errors.examResultId = "Result id is required.";
  }
  if (!input.reason?.trim()) {
    errors.reason = "Correction reason is required.";
  }
  validateMarksPair(
    input.marksObtained,
    input.maxMarks,
    input.isAbsent,
    "",
    errors,
  );
  return errors;
}
