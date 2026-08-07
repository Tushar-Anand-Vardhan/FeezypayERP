/** Homework & Assignment Engine public surface. */

export type * from "@/lib/homework/types";
export {
  validateCreateHomeworkInput,
  validateUpdateHomeworkInput,
  validateRecordSubmissionInput,
  validateGradeSubmissionInput,
  computeIsLate,
} from "@/lib/homework/validation";

export {
  createHomeworkAction,
  updateHomeworkAction,
  publishHomeworkAction,
  closeHomeworkAction,
  archiveHomeworkAction,
  setHomeworkParentVisibilityAction,
} from "@/lib/homework/homework-actions";

export {
  recordHomeworkSubmissionAction,
  gradeHomeworkSubmissionAction,
  submitHomeworkAsStudentAction,
  requestHomeworkAiEvaluationAction,
} from "@/lib/homework/submission-actions";

export {
  listHomeworkAction,
  getHomeworkAction,
  listHomeworkSubmissionsAction,
  listStudentHomeworkAction,
  listHomeworkAuditAction,
} from "@/lib/homework/query-actions";
