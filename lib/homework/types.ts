/** Homework & Assignment Engine — types. */

export type HomeworkActionResult =
  | { success: true; message: string; id?: string; ids?: string[]; count?: number }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type AssignmentKind = "homework" | "assignment" | "project";

export type HomeworkStatus = "draft" | "assigned" | "closed";

export type SubmissionStatus =
  | "not_submitted"
  | "draft"
  | "submitted"
  | "late"
  | "returned"
  | "graded"
  | "excused";

export type AiEvaluationStatus =
  | "none"
  | "pending"
  | "completed"
  | "failed"
  | "disabled";

export type CreateHomeworkInput = {
  academicYearId: string;
  employmentId: string;
  sectionId: string;
  classId?: string | null;
  subjectId?: string | null;
  assignmentKind: AssignmentKind;
  title: string;
  description?: string | null;
  instructions?: string | null;
  assignedOn?: string;
  dueOn?: string | null;
  dueAt?: string | null;
  maxMarks?: number | null;
  allowLate?: boolean;
  lateUntil?: string | null;
  attachmentMediaIds?: string[];
  parentVisible?: boolean;
  visibleToStudents?: boolean;
  aiEvaluationEnabled?: boolean;
  /** If true, status=assigned and published_at set */
  publishNow?: boolean;
};

export type UpdateHomeworkInput = {
  id: string;
  title?: string;
  description?: string | null;
  instructions?: string | null;
  subjectId?: string | null;
  classId?: string | null;
  dueOn?: string | null;
  dueAt?: string | null;
  maxMarks?: number | null;
  allowLate?: boolean;
  lateUntil?: string | null;
  attachmentMediaIds?: string[];
  parentVisible?: boolean;
  visibleToStudents?: boolean;
  aiEvaluationEnabled?: boolean;
};

export type RecordSubmissionInput = {
  homeworkId: string;
  studentProfileId: string;
  status?: SubmissionStatus;
  submittedAt?: string | null;
  attachmentMediaIds?: string[];
  studentNotes?: string | null;
  marksAwarded?: number | null;
  teacherFeedback?: string | null;
  /** When marks/feedback provided, mark graded */
  gradeNow?: boolean;
  employmentId?: string | null;
};

export type GradeSubmissionInput = {
  submissionId: string;
  marksAwarded: number;
  teacherFeedback?: string | null;
  status?: "graded" | "returned";
  employmentId?: string | null;
};

export const ASSIGNMENT_KINDS: AssignmentKind[] = [
  "homework",
  "assignment",
  "project",
];

export const HOMEWORK_STATUSES: HomeworkStatus[] = [
  "draft",
  "assigned",
  "closed",
];

export const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "not_submitted",
  "draft",
  "submitted",
  "late",
  "returned",
  "graded",
  "excused",
];

export const AI_EVALUATION_STATUSES: AiEvaluationStatus[] = [
  "none",
  "pending",
  "completed",
  "failed",
  "disabled",
];
