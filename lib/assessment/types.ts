/** Assessment Configuration Engine (E11 config surface). Marks: see ops-types / results-actions. */

export type AssessmentActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type AssessmentCategoryKind =
  | "theory"
  | "internal"
  | "practical"
  | "project"
  | "oral"
  | "optional"
  | "other";

export type AssessmentComponentType =
  | "theory"
  | "practical"
  | "internal"
  | "project"
  | "oral"
  | "other";

export type PublishingStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "locked"
  | "retracted";

export type PublishRules = {
  visibleToParents?: boolean;
  visibleToStudents?: boolean;
  requireSchedules?: boolean;
  autoLockOnPublish?: boolean;
};

export type LockRules = {
  lockOnPublish?: boolean;
  preventEditWhenLocked?: boolean;
  preventArchiveWhenLocked?: boolean;
};

export type ExamTypeInput = {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  defaultWeightagePercent?: number | null;
  defaultMaxMarks?: number | null;
  defaultPassMarks?: number | null;
  displayOrder?: number;
};

export type AssessmentCategoryInput = {
  id?: string;
  code?: string;
  name: string;
  kind: AssessmentCategoryKind;
  description?: string;
  displayOrder?: number;
};

export type AssessmentPolicyInput = {
  academicYearId?: string | null;
  defaultPassPercent?: number;
  defaultGradingScaleId?: string | null;
  publishRules?: PublishRules;
  lockRules?: LockRules;
  moderationEnabled?: boolean;
  aiEvaluationEnabled?: boolean;
};

export type ExamDefinitionInput = {
  id?: string;
  academicYearId: string;
  termId?: string | null;
  name: string;
  /** Legacy onboarding category string */
  category?: string;
  examTypeId?: string | null;
  assessmentCategoryId?: string | null;
  weightagePercent?: number | null;
  maxMarks?: number | null;
  passMarks?: number | null;
  gradingType?: "marks" | "letter_grade" | "rubric";
  gradingScaleVersionId?: string | null;
  subjectGroupId?: string | null;
  includesOptionalSubjects?: boolean;
  description?: string;
  publishRules?: PublishRules;
  lockRules?: LockRules;
  moderationEnabled?: boolean;
  aiEvaluationEnabled?: boolean;
  publishingStatus?: PublishingStatus;
  publishAt?: string | null;
};

export type AssessmentComponentInput = {
  id?: string;
  examDefinitionId: string;
  componentType: AssessmentComponentType;
  name: string;
  weightagePercent?: number | null;
  maxMarks?: number | null;
  passMarks?: number | null;
  isOptional?: boolean;
  displayOrder?: number;
};

export type ExamSubjectScheduleInput = {
  id?: string;
  examDefinitionId: string;
  subjectId: string;
  classId: string;
  sectionId?: string | null;
  gradingType?: "marks" | "letter_grade" | "rubric";
  maxMarks?: number | null;
  passMarks?: number | null;
  isOptionalSubject?: boolean;
  componentType?: AssessmentComponentType | null;
  gradingScaleVersionId?: string | null;
  rubricId?: string | null;
  /** @deprecated Prefer startsAt */
  scheduledAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  markingOpensAt?: string | null;
  markingClosesAt?: string | null;
  dayKind?: "half_day" | "full_day" | null;
  periodId?: string | null;
};

export const EXAM_DAY_KINDS = ["half_day", "full_day"] as const;

export const ASSESSMENT_CATEGORY_KINDS: AssessmentCategoryKind[] = [
  "theory",
  "internal",
  "practical",
  "project",
  "oral",
  "optional",
  "other",
];

export const ASSESSMENT_COMPONENT_TYPES: AssessmentComponentType[] = [
  "theory",
  "practical",
  "internal",
  "project",
  "oral",
  "other",
];

export const PUBLISHING_STATUSES: PublishingStatus[] = [
  "draft",
  "scheduled",
  "published",
  "locked",
  "retracted",
];

export const LEGACY_EXAM_CATEGORIES = [
  "unit_test",
  "quiz",
  "midterm",
  "final",
  "oral",
  "project",
  "internal",
  "practical",
  "other",
] as const;
