/** Teacher Analytics Engine public surface (E22 teacher slice). */

export type * from "@/lib/teacher-analytics/types";
export {
  TEACHER_ANALYTICS_THRESHOLDS,
  TEACHER_GENERATOR_VERSION,
} from "@/lib/teacher-analytics/types";
export {
  deriveTeacherInsights,
  validateGenerateTeacherInput,
} from "@/lib/teacher-analytics/rules";
export { buildTeacherAnalyticsReport } from "@/lib/teacher-analytics/aggregate";

export {
  generateTeacherAnalyticsAction,
  getLatestTeacherAnalyticsSnapshotAction,
  listTeacherAnalyticsSnapshotsAction,
  listTeacherWorkloadRisksAction,
} from "@/lib/teacher-analytics/analytics-actions";
