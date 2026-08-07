import type {
  AssessmentRecordInput,
  AttachmentInput,
  BulkMarksInput,
  MarkEntryInput,
  OutcomeCoverageInput,
  TopicCoverageInput,
} from "@/lib/assessment-recording/types";
import {
  ATTACHMENT_KINDS,
  COVERAGE_NODE_TYPES,
  LOCK_PERMISSIONS,
  TEACHER_RECORDING_PERMISSIONS,
} from "@/lib/assessment-recording/types";

export function validateRecordInput(
  input: AssessmentRecordInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.assessmentFrameworkId?.trim()) {
    errors.assessmentFrameworkId = "Required";
  }
  if (!input.assessmentFrameworkVersionId?.trim()) {
    errors.assessmentFrameworkVersionId = "Required";
  }
  if (!input.frameworkCategoryId?.trim()) {
    errors.frameworkCategoryId = "Required";
  }
  if (!input.title?.trim()) errors.title = "Required";
  if (!input.conductedOn?.trim()) errors.conductedOn = "Required";
  if (!input.classId?.trim()) errors.classId = "Required";
  if (!input.sectionId?.trim()) errors.sectionId = "Required";
  if (!input.subjectId?.trim()) errors.subjectId = "Required";
  if (!input.authorEmploymentId?.trim()) {
    errors.authorEmploymentId = "Required";
  }
  if (!input.academicYearId?.trim()) errors.academicYearId = "Required";
  if (!(input.maxMarks > 0)) errors.maxMarks = "Must be > 0";
  return errors;
}

export function validateMarkEntry(
  input: MarkEntryInput,
  maxMarks: number,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.recordId?.trim()) errors.recordId = "Required";
  if (!input.studentProfileId?.trim()) errors.studentProfileId = "Required";
  if (!input.enteredByEmploymentId?.trim()) {
    errors.enteredByEmploymentId = "Required";
  }
  if (!input.isAbsent) {
    if (input.marksObtained == null) {
      errors.marksObtained = "Required unless absent";
    } else if (input.marksObtained < 0) {
      errors.marksObtained = "Must be ≥ 0";
    } else if (input.marksObtained > maxMarks) {
      errors.marksObtained = `Must be ≤ max marks (${maxMarks})`;
    }
  }
  return errors;
}

export function validateBulkMarks(
  input: BulkMarksInput,
  maxMarks: number,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.recordId?.trim()) errors.recordId = "Required";
  if (!input.enteredByEmploymentId?.trim()) {
    errors.enteredByEmploymentId = "Required";
  }
  if (!input.entries?.length) errors.entries = "At least one entry required";
  for (const e of input.entries ?? []) {
    const one = validateMarkEntry(
      {
        recordId: input.recordId,
        studentProfileId: e.studentProfileId,
        marksObtained: e.marksObtained,
        isAbsent: e.isAbsent,
        remarks: e.remarks,
        enteredByEmploymentId: input.enteredByEmploymentId,
      },
      maxMarks,
    );
    if (Object.keys(one).length) {
      errors.entries = one.marksObtained ?? one.studentProfileId ?? "Invalid entry";
      break;
    }
  }
  return errors;
}

export function validateTopicCoverage(
  input: TopicCoverageInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.recordId?.trim()) errors.recordId = "Required";
  if (!input.nodeId?.trim()) errors.nodeId = "Required";
  if (!(COVERAGE_NODE_TYPES as readonly string[]).includes(input.nodeType)) {
    errors.nodeType = "Invalid node type";
  }
  return errors;
}

export function validateOutcomeCoverage(
  input: OutcomeCoverageInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.recordId?.trim()) errors.recordId = "Required";
  if (!input.learningOutcomeId?.trim()) errors.learningOutcomeId = "Required";
  return errors;
}

export function validateAttachment(
  input: AttachmentInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.recordId?.trim()) errors.recordId = "Required";
  if (!input.title?.trim()) errors.title = "Required";
  if (
    input.resourceKind &&
    !(ATTACHMENT_KINDS as readonly string[]).includes(input.resourceKind)
  ) {
    errors.resourceKind = "Invalid kind";
  }
  return errors;
}

/** Marks must never be updated in place — always supersede. */
export function marksAreAppendOnly(): boolean {
  return true;
}

export function teacherMayEditRecordStatus(status: string): boolean {
  return status === "draft" || status === "open";
}

export function teacherRecordingPermissionKeys(): readonly string[] {
  return TEACHER_RECORDING_PERMISSIONS;
}

export function lockPermissionKeys(): readonly string[] {
  return LOCK_PERMISSIONS;
}

export function isLockPermission(key: string): boolean {
  return (LOCK_PERMISSIONS as readonly string[]).includes(key);
}
