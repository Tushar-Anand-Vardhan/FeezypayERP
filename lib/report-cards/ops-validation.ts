import type {
  CreateReportCardDraftInput,
  FillReportCardFieldsInput,
  IssueReportCardInput,
  UpdateReportCardRemarksInput,
} from "@/lib/report-cards/ops-types";
import {
  FIELD_ASSIGNEE_ROLES,
  type FieldAssignmentInput,
} from "@/lib/report-cards/types";

export function validateCreateDraftInput(
  input: CreateReportCardDraftInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.studentProfileId?.trim()) {
    errors.studentProfileId = "Student is required.";
  }
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!input.templateId?.trim()) {
    errors.templateId = "Template is required.";
  }
  if (input.teacherRemarks && input.teacherRemarks.length > 5000) {
    errors.teacherRemarks = "Teacher remarks are too long.";
  }
  if (input.principalRemarks && input.principalRemarks.length > 5000) {
    errors.principalRemarks = "Principal remarks are too long.";
  }
  return errors;
}

export function validateUpdateRemarksInput(
  input: UpdateReportCardRemarksInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.issueId?.trim()) {
    errors.issueId = "Issue id is required.";
  }
  if (input.teacherRemarks && input.teacherRemarks.length > 5000) {
    errors.teacherRemarks = "Teacher remarks are too long.";
  }
  if (input.principalRemarks && input.principalRemarks.length > 5000) {
    errors.principalRemarks = "Principal remarks are too long.";
  }
  return errors;
}

export function validateFillFieldsInput(
  input: FillReportCardFieldsInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.issueId?.trim()) {
    errors.issueId = "Issue id is required.";
  }
  if (!input.fields || typeof input.fields !== "object") {
    errors.fields = "Fields map is required.";
  }
  return errors;
}

export function validateIssueInput(
  input: IssueReportCardInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.issueId?.trim()) {
    errors.issueId = "Issue id is required.";
  }
  return errors;
}

export function validateFieldAssignmentInput(
  input: FieldAssignmentInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.templateId?.trim()) {
    errors.templateId = "Template is required.";
  }
  if (!input.fieldKey?.trim()) {
    errors.fieldKey = "Field key is required.";
  } else if (!/^[a-z][a-z0-9_]{1,63}$/.test(input.fieldKey.trim())) {
    errors.fieldKey =
      "Field key must be snake_case starting with a letter (2–64 chars).";
  }
  if (!input.fieldLabel?.trim()) {
    errors.fieldLabel = "Field label is required.";
  }
  if (
    input.assigneeRole &&
    !FIELD_ASSIGNEE_ROLES.includes(input.assigneeRole)
  ) {
    errors.assigneeRole = "Invalid assignee role.";
  }
  if (
    input.maxLength != null &&
    (input.maxLength < 1 || input.maxLength > 20000)
  ) {
    errors.maxLength = "Max length must be 1–20000.";
  }
  return errors;
}

/** Draft versions may be regenerated; published/locked versions are immutable. */
export function mayRegenerateVersion(status: string): boolean {
  return status === "draft";
}

export function mayEditRemarks(versionStatus: string, issueStatus: string): boolean {
  if (issueStatus === "revoked" || issueStatus === "locked") return false;
  if (versionStatus === "locked" || versionStatus === "revoked") return false;
  return versionStatus === "draft";
}

export function mayFillFields(versionStatus: string, issueStatus: string): boolean {
  return mayEditRemarks(versionStatus, issueStatus);
}

export function mayPublishVersion(versionStatus: string, issueStatus: string): boolean {
  if (issueStatus === "revoked" || issueStatus === "locked") return false;
  return versionStatus === "draft";
}

export function mayLockIssue(issueStatus: string): boolean {
  return issueStatus === "published" || issueStatus === "issued";
}
