/** Report Card Engine public surface (templates + issue). */

export type * from "@/lib/report-cards/types";
export type * from "@/lib/report-cards/ops-types";

export {
  createReportCardDraftAction,
  regenerateReportCardDraftAction,
  updateReportCardRemarksAction,
  fillReportCardFieldsAction,
  issueReportCardAction,
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

export {
  listReportCardTemplatesAction,
  upsertReportCardTemplateAction,
  publishReportCardTemplateAction,
  retireReportCardTemplateAction,
  cloneReportCardTemplateAsDraftAction,
} from "@/lib/report-cards/templates-actions";

export {
  listReportCardBlocksAction,
  upsertReportCardBlockAction,
  archiveReportCardBlockAction,
} from "@/lib/report-cards/blocks-actions";

export {
  listReportCardScopesAction,
  upsertReportCardScopeAction,
  archiveReportCardScopeAction,
} from "@/lib/report-cards/scopes-actions";
