import type {
  CreateReportCardDraftInput,
  IssueReportCardInput,
  UpdateReportCardRemarksInput,
} from "@/lib/report-cards/ops-types";

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

export function validateIssueInput(
  input: IssueReportCardInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.issueId?.trim()) {
    errors.issueId = "Issue id is required.";
  }
  return errors;
}

/** Draft versions may be regenerated; issued versions are immutable. */
export function mayRegenerateVersion(status: string): boolean {
  return status === "draft";
}

export function mayEditRemarks(versionStatus: string, issueStatus: string): boolean {
  if (issueStatus === "revoked") return false;
  return versionStatus === "draft";
}
