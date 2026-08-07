/** Assessment Recording Engine (E32) — shared types */

export const RECORD_STATUSES = ["draft", "open", "locked"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const COVERAGE_NODE_TYPES = [
  "unit",
  "chapter",
  "topic",
  "subtopic",
] as const;
export type CoverageNodeType = (typeof COVERAGE_NODE_TYPES)[number];

export const ATTACHMENT_KINDS = ["link", "file", "note", "other"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const TEACHER_RECORDING_PERMISSIONS = [
  "assessment_recording.read",
  "assessment_recording.create",
  "assessment_recording.edit",
  "assessment_recording.enter_marks",
] as const;

export const LOCK_PERMISSIONS = [
  "assessment_recording.lock",
  "assessment_recording.unlock",
] as const;

export type RecordingActionResult =
  | { success: true; id?: string; [key: string]: unknown }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type AssessmentRecordInput = {
  assessmentFrameworkId: string;
  assessmentFrameworkVersionId: string;
  frameworkCategoryId: string;
  title: string;
  conductedOn: string;
  description?: string | null;
  classId: string;
  sectionId: string;
  subjectId: string;
  maxMarks: number;
  authorEmploymentId: string;
  academicYearId: string;
  status?: "draft" | "open";
};

export type MarkEntryInput = {
  recordId: string;
  studentProfileId: string;
  marksObtained?: number | null;
  isAbsent?: boolean;
  remarks?: string | null;
  enteredByEmploymentId: string;
};

export type BulkMarksInput = {
  recordId: string;
  enteredByEmploymentId: string;
  entries: Array<{
    studentProfileId: string;
    marksObtained?: number | null;
    isAbsent?: boolean;
    remarks?: string | null;
  }>;
};

export type TopicCoverageInput = {
  recordId: string;
  nodeType: CoverageNodeType;
  nodeId: string;
  curriculumVersionId?: string | null;
};

export type OutcomeCoverageInput = {
  recordId: string;
  learningOutcomeId: string;
};

export type AttachmentInput = {
  recordId: string;
  title: string;
  resourceKind?: AttachmentKind;
  url?: string | null;
  mediaId?: string | null;
};
