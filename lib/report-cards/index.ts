/** Report Card Engine public surface (templates + issue). */

export type * from "@/lib/report-cards/types";
export type * from "@/lib/report-cards/ops-types";

export {
  createReportCardDraftAction,
  regenerateReportCardDraftAction,
  updateReportCardRemarksAction,
  fillReportCardFieldsAction,
  issueReportCardAction,
  publishReportCardAction,
  lockReportCardAction,
  revokeReportCardAction,
} from "@/lib/report-cards/issue-actions";

export {
  listReportCardIssuesAction,
  getReportCardIssueAction,
  listReportCardVersionsAction,
  getReportCardVersionAction,
  listReportCardAuditAction,
  previewReportCardAssemblyAction,
} from "@/lib/report-cards/issue-query-actions";

export {
  upsertReportCardFieldAssignmentAction,
  archiveReportCardFieldAssignmentAction,
  listReportCardFieldAssignmentsAction,
} from "@/lib/report-cards/field-assignments-actions";
