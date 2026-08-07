import type {
  CreateHomeworkInput,
  GradeSubmissionInput,
  RecordSubmissionInput,
  UpdateHomeworkInput,
} from "@/lib/homework/types";
import {
  ASSIGNMENT_KINDS,
  SUBMISSION_STATUSES,
} from "@/lib/homework/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

export function computeIsLate(input: {
  submittedAt: string | null | undefined;
  dueOn: string | null | undefined;
  dueAt: string | null | undefined;
  allowLate: boolean;
  lateUntil: string | null | undefined;
}): boolean {
  if (!input.submittedAt) return false;
  const submitted = new Date(input.submittedAt).getTime();
  if (Number.isNaN(submitted)) return false;

  let deadline: number | null = null;
  if (input.dueAt) {
    const t = new Date(input.dueAt).getTime();
    if (!Number.isNaN(t)) deadline = t;
  } else if (input.dueOn) {
    // End of due day local-ish: treat as end of calendar day UTC
    const t = Date.parse(`${input.dueOn}T23:59:59.999Z`);
    if (!Number.isNaN(t)) deadline = t;
  }
  if (deadline == null) return false;
  if (submitted <= deadline) return false;

  if (!input.allowLate) return true;
  if (input.lateUntil) {
    const lateEnd = Date.parse(`${input.lateUntil}T23:59:59.999Z`);
    if (!Number.isNaN(lateEnd) && submitted > lateEnd) return true;
  }
  return true;
}

export function validateCreateHomeworkInput(
  input: CreateHomeworkInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!input.employmentId?.trim()) {
    errors.employmentId = "Teacher employment is required.";
  }
  if (!input.sectionId?.trim()) {
    errors.sectionId = "Section is required.";
  }
  if (!input.title?.trim()) {
    errors.title = "Title is required.";
  }
  if (!(ASSIGNMENT_KINDS as string[]).includes(input.assignmentKind)) {
    errors.assignmentKind = "Invalid assignment kind.";
  }
  if (input.assignedOn && !isValidDate(input.assignedOn)) {
    errors.assignedOn = "Assigned date is invalid.";
  }
  if (input.dueOn && !isValidDate(input.dueOn)) {
    errors.dueOn = "Due date is invalid.";
  }
  if (input.lateUntil && !isValidDate(input.lateUntil)) {
    errors.lateUntil = "Late-until date is invalid.";
  }
  if (
    input.dueOn &&
    input.assignedOn &&
    isValidDate(input.dueOn) &&
    isValidDate(input.assignedOn) &&
    input.dueOn < input.assignedOn
  ) {
    errors.dueOn = "Due date cannot be before assigned date.";
  }
  if (
    input.lateUntil &&
    input.dueOn &&
    isValidDate(input.lateUntil) &&
    isValidDate(input.dueOn) &&
    input.lateUntil < input.dueOn
  ) {
    errors.lateUntil = "Late-until cannot be before due date.";
  }
  if (input.maxMarks != null && input.maxMarks < 0) {
    errors.maxMarks = "Max marks cannot be negative.";
  }
  if (input.dueAt && Number.isNaN(Date.parse(input.dueAt))) {
    errors.dueAt = "Due time is invalid.";
  }
  return errors;
}

export function validateUpdateHomeworkInput(
  input: UpdateHomeworkInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.id?.trim()) {
    errors.id = "Homework id is required.";
  }
  if (input.dueOn && !isValidDate(input.dueOn)) {
    errors.dueOn = "Due date is invalid.";
  }
  if (input.lateUntil && !isValidDate(input.lateUntil)) {
    errors.lateUntil = "Late-until date is invalid.";
  }
  if (input.maxMarks != null && input.maxMarks < 0) {
    errors.maxMarks = "Max marks cannot be negative.";
  }
  if (input.dueAt && Number.isNaN(Date.parse(input.dueAt))) {
    errors.dueAt = "Due time is invalid.";
  }
  return errors;
}

export function validateRecordSubmissionInput(
  input: RecordSubmissionInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.homeworkId?.trim()) {
    errors.homeworkId = "Homework is required.";
  }
  if (!input.studentProfileId?.trim()) {
    errors.studentProfileId = "Student is required.";
  }
  if (
    input.status &&
    !(SUBMISSION_STATUSES as string[]).includes(input.status)
  ) {
    errors.status = "Invalid submission status.";
  }
  if (input.marksAwarded != null && input.marksAwarded < 0) {
    errors.marksAwarded = "Marks cannot be negative.";
  }
  if (input.submittedAt && Number.isNaN(Date.parse(input.submittedAt))) {
    errors.submittedAt = "Submitted time is invalid.";
  }
  return errors;
}

export function validateGradeSubmissionInput(
  input: GradeSubmissionInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.submissionId?.trim()) {
    errors.submissionId = "Submission id is required.";
  }
  if (input.marksAwarded == null || Number.isNaN(input.marksAwarded)) {
    errors.marksAwarded = "Marks are required.";
  } else if (input.marksAwarded < 0) {
    errors.marksAwarded = "Marks cannot be negative.";
  }
  return errors;
}
