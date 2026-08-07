/** Curriculum Engine (E30) — shared types */

export const CURRICULUM_STATUSES = ["draft", "published", "retired"] as const;
export type CurriculumStatus = (typeof CURRICULUM_STATUSES)[number];

export const STRUCTURE_NODE_KINDS = [
  "unit",
  "chapter",
  "topic",
  "subtopic",
] as const;
export type StructureNodeKind = (typeof STRUCTURE_NODE_KINDS)[number];

export const PROGRESS_NODE_TYPES = [
  "unit",
  "chapter",
  "topic",
  "subtopic",
] as const;
export type ProgressNodeType = (typeof PROGRESS_NODE_TYPES)[number];

export const PROGRESS_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "skipped",
] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export const RESOURCE_KINDS = ["link", "file", "note", "other"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCE_VISIBILITIES = ["shared", "staff"] as const;
export type ResourceVisibility = (typeof RESOURCE_VISIBILITIES)[number];

export const NOTE_VISIBILITIES = ["private", "shared"] as const;
export type NoteVisibility = (typeof NOTE_VISIBILITIES)[number];

export type CurriculumActionResult =
  | { success: true; id?: string; versionId?: string; [key: string]: unknown }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type CurriculumPackInput = {
  academicYearId: string;
  subjectId: string;
  classId: string;
  boardId?: string | null;
  boardCode?: string | null;
  code?: string;
  name: string;
  description?: string | null;
  suggestedTotalHours?: number | null;
};

export type StructureNodeInput = {
  curriculumId: string;
  title: string;
  code?: string | null;
  description?: string | null;
  suggestedHours?: number | null;
  displayOrder?: number;
  textbookRef?: string | null;
  /** Parent ids depending on kind */
  unitId?: string;
  chapterId?: string;
  topicId?: string;
};

export type LearningOutcomeInput = {
  curriculumId: string;
  statement: string;
  code?: string | null;
  bloomLevel?: string | null;
  displayOrder?: number;
  unitId?: string | null;
  chapterId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
};

export type CompetencyInput = {
  curriculumId: string;
  name: string;
  code?: string | null;
  framework?: string | null;
  description?: string | null;
  displayOrder?: number;
};

export type ResourceInput = {
  curriculumId: string;
  title: string;
  resourceKind?: ResourceKind;
  url?: string | null;
  mediaId?: string | null;
  visibility?: ResourceVisibility;
  displayOrder?: number;
  unitId?: string | null;
  chapterId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
};

export type NoteInput = {
  curriculumId: string;
  body: string;
  authorEmploymentId: string;
  visibility?: NoteVisibility;
  unitId?: string | null;
  chapterId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
};

export type ProgressInput = {
  curriculumId: string;
  curriculumVersionId: string;
  sectionId: string;
  employmentId: string;
  nodeType: ProgressNodeType;
  nodeId: string;
  status: ProgressStatus;
  completionPct?: number | null;
  teachingNotes?: string | null;
};

export type CloneCurriculumInput = {
  sourceCurriculumId: string;
  targetAcademicYearId: string;
  targetClassId?: string | null;
  name?: string;
  code?: string;
};

export type CurriculumSnapshot = {
  pack: Record<string, unknown>;
  units: Array<Record<string, unknown>>;
  chapters: Array<Record<string, unknown>>;
  topics: Array<Record<string, unknown>>;
  subtopics: Array<Record<string, unknown>>;
  learningOutcomes: Array<Record<string, unknown>>;
  competencies: Array<Record<string, unknown>>;
  outcomeCompetencies: Array<Record<string, unknown>>;
  resources: Array<Record<string, unknown>>;
};

/** Teacher-facing structure edit is denied — keys required for structure writers */
export const STRUCTURE_EDIT_PERMISSIONS = [
  "curriculum.structure.edit",
] as const;
