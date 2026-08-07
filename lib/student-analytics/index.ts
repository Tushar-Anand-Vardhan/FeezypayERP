/** Student Analytics Engine public surface (E22 student slice). */

export type * from "@/lib/student-analytics/types";
export {
  ANALYTICS_THRESHOLDS,
  GENERATOR_VERSION,
} from "@/lib/student-analytics/types";
export { deriveInsights, validateGenerateInput } from "@/lib/student-analytics/rules";
export { buildStudentAnalyticsReport } from "@/lib/student-analytics/aggregate";

export {
  generateStudentAnalyticsAction,
  getLatestStudentAnalyticsSnapshotAction,
  listStudentAnalyticsSnapshotsAction,
  listStudentRiskIndicatorsAction,
} from "@/lib/student-analytics/analytics-actions";
