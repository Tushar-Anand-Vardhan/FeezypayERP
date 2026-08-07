/** Assessment Operations Engine (E11 marks) — types. */

export type AssessmentOpsActionResult =
  | { success: true; message: string; id?: string; sessionId?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

/** Marks lifecycle — teachers edit until locked. */
export type MarksWorkflowStatus = "draft" | "published" | "locked";

export type AssessmentOperationalKind =
  | "class_test"
  | "project"
  | "practical"
  | "assignment"
  | "oral"
  | "other";

export type TeacherAssessmentInput = {
  academicYearId: string;
  termId?: string | null;
  name: string;
  operationalKind: AssessmentOperationalKind;
  subjectId: string;
  classId: string;
  sectionId?: string | null;
  maxMarks: number;
  passMarks?: number | null;
  gradingType?: "marks" | "letter_grade" | "rubric";
  weightagePercent?: number | null;
  examTypeId?: string | null;
  assessmentCategoryId?: string | null;
  assessedOn?: string | null;
  dueOn?: string | null;
  description?: string | null;
  employmentId?: string | null;
};

export type SingleMarkInput = {
  examDefinitionId: string;
  subjectId: string;
  studentProfileId: string;
  academicYearId: string;
  marksObtained?: number | null;
  maxMarks?: number | null;
  gradeLabel?: string | null;
  isAbsent?: boolean;
  teacherRemark?: string | null;
  sectionId?: string | null;
  classId?: string | null;
  scheduleId?: string | null;
  componentId?: string | null;
  studentAcademicYearId?: string | null;
  gradingScaleVersionId?: string | null;
  employmentId?: string | null;
};

export type BulkMarksInput = {
  examDefinitionId: string;
  subjectId: string;
  academicYearId: string;
  sectionId?: string | null;
  classId?: string | null;
  scheduleId?: string | null;
  componentId?: string | null;
  employmentId?: string | null;
  defaultMaxMarks?: number | null;
  marks: Array<{
    studentProfileId: string;
    marksObtained?: number | null;
    maxMarks?: number | null;
    gradeLabel?: string | null;
    isAbsent?: boolean;
    teacherRemark?: string | null;
    studentAcademicYearId?: string | null;
  }>;
};

export type CorrectMarkInput = {
  examResultId: string;
  marksObtained?: number | null;
  maxMarks?: number | null;
  gradeLabel?: string | null;
  isAbsent?: boolean;
  teacherRemark?: string | null;
  reason: string;
};

export type MarksAnalyticsQuery = {
  academicYearId: string;
  examDefinitionId?: string;
  subjectId?: string;
  sectionId?: string;
  studentProfileId?: string;
};

export const MARKS_WORKFLOW_STATUSES: MarksWorkflowStatus[] = [
  "draft",
  "published",
  "locked",
];

export const TEACHER_EDITABLE_MARKS_WORKFLOWS: MarksWorkflowStatus[] = [
  "draft",
  "published",
];

export const ASSESSMENT_OPERATIONAL_KINDS: AssessmentOperationalKind[] = [
  "class_test",
  "project",
  "practical",
  "assignment",
  "oral",
  "other",
];
