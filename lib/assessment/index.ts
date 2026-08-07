/** Assessment Engine public surface (config + operations). */

export type * from "@/lib/assessment/types";
export type * from "@/lib/assessment/ops-types";

export {
  createTeacherAssessmentAction,
  listTeacherAssessmentsAction,
  listScheduledAssessmentsAction,
  archiveTeacherAssessmentAction,
} from "@/lib/assessment/teacher-assessments-actions";

export {
  upsertMarkAction,
  bulkUpsertMarksAction,
  correctMarkAction,
} from "@/lib/assessment/results-actions";

export {
  publishMarkSessionAction,
  lockMarkSessionAction,
  unlockMarkSessionAction,
} from "@/lib/assessment/mark-session-actions";

export {
  listSessionMarksAction,
  listStudentMarksAction,
  getMarksAnalyticsAction,
  listAssessmentResultsAuditAction,
} from "@/lib/assessment/results-query-actions";
