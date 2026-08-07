/** Student Achievement Engine (E35) public surface. */

export type * from "@/lib/achievements/types";
export * from "@/lib/achievements/validation";
export { upsertAchievementFromParticipant } from "@/lib/achievements/server-helpers";

export {
  recordAchievementFromEventAction,
  syncAchievementsFromEventAction,
  recordManualAchievementAction,
  updateAchievementOutcomesAction,
  archiveStudentAchievementAction,
} from "@/lib/achievements/record-actions";

export {
  listStudentAchievementsAction,
  listStudentAchievementTimelineAction,
  getStudentAchievementAction,
  listAchievementAuditAction,
} from "@/lib/achievements/query-actions";

export {
  queueAchievementAiSummaryAction,
  listAchievementAiSummariesAction,
} from "@/lib/achievements/ai-actions";
