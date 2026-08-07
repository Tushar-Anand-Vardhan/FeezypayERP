/** Subject Configuration Engine (E07 surface) types. */

export type SubjectActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type SubjectCategory =
  | "scholastic"
  | "co_scholastic"
  | "language"
  | "elective";

export type SubjectDependencyType =
  | "prerequisite"
  | "corequisite"
  | "recommended";

export type AssessmentRules = {
  gradingType?: "marks" | "grade" | "pass_fail";
  maxMarks?: number | null;
  passMarks?: number | null;
  hasPractical?: boolean;
  practicalWeightage?: number | null;
  internalAssessment?: boolean;
  internalMaxMarks?: number | null;
};

export type SubjectGroupInput = {
  id?: string;
  name: string;
  code?: string;
  description?: string;
  displayOrder?: number;
};

export type SubjectMasterInput = {
  id?: string;
  name: string;
  code?: string;
  description?: string;
  /** Legacy onboarding column — synced from category when omitted */
  type?: "scholastic" | "co_scholastic";
  category?: SubjectCategory;
  subjectGroupId?: string | null;
  isLanguage?: boolean;
  languageCode?: string | null;
  isElective?: boolean;
  boardCode?: string | null;
  boardSubjectName?: string | null;
  credits?: number | null;
  weeklyPeriods?: number | null;
  requiresLab?: boolean;
  displayOrder?: number;
  assessmentRules?: AssessmentRules;
  textbookIsbn?: string | null;
  textbookTitle?: string | null;
  aiLessonPlanEnabled?: boolean;
  chapterMap?: unknown[];
};

export type SubjectDependencyInput = {
  subjectId: string;
  dependsOnSubjectId: string;
  dependencyType?: SubjectDependencyType;
  notes?: string;
};

export const SUBJECT_CATEGORIES: SubjectCategory[] = [
  "scholastic",
  "co_scholastic",
  "language",
  "elective",
];

export const SUBJECT_DEPENDENCY_TYPES: SubjectDependencyType[] = [
  "prerequisite",
  "corequisite",
  "recommended",
];

export const SUBJECT_CATEGORY_LABELS: Record<SubjectCategory, string> = {
  scholastic: "Scholastic",
  co_scholastic: "Co-scholastic",
  language: "Language",
  elective: "Elective",
};
