/** Student Observation Engine (E34) — types */

export type ObservationActionResult =
  | { success: true; message: string; id?: string; ids?: string[] }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type ObservationVisibility =
  | "private"
  | "staff"
  | "parent_visible"
  | "school";

export type ObservationCategoryCode =
  | "academic"
  | "behaviour"
  | "participation"
  | "leadership"
  | "creativity"
  | "communication"
  | "reading"
  | "writing"
  | "speaking"
  | "discipline"
  | "social_skills"
  | "custom";

export type SystemCategorySeed = {
  code: ObservationCategoryCode | string;
  name: string;
  displayOrder: number;
};

export const SYSTEM_OBSERVATION_CATEGORIES: SystemCategorySeed[] = [
  { code: "academic", name: "Academic", displayOrder: 1 },
  { code: "behaviour", name: "Behaviour", displayOrder: 2 },
  { code: "participation", name: "Participation", displayOrder: 3 },
  { code: "leadership", name: "Leadership", displayOrder: 4 },
  { code: "creativity", name: "Creativity", displayOrder: 5 },
  { code: "communication", name: "Communication", displayOrder: 6 },
  { code: "reading", name: "Reading", displayOrder: 7 },
  { code: "writing", name: "Writing", displayOrder: 8 },
  { code: "speaking", name: "Speaking", displayOrder: 9 },
  { code: "discipline", name: "Discipline", displayOrder: 10 },
  { code: "social_skills", name: "Social Skills", displayOrder: 11 },
];

export const OBSERVATION_VISIBILITIES: ObservationVisibility[] = [
  "private",
  "staff",
  "parent_visible",
  "school",
];

export type RecordObservationInput = {
  studentProfileId: string;
  academicYearId: string;
  categoryId?: string;
  categoryCode?: string;
  remark: string;
  observedOn: string;
  termId?: string | null;
  subjectId?: string | null;
  visibility?: ObservationVisibility;
  employmentId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
};

export type SupersedeObservationInput = {
  observationId: string;
  remark: string;
  observedOn?: string;
  categoryId?: string;
  categoryCode?: string;
  termId?: string | null;
  subjectId?: string | null;
  visibility?: ObservationVisibility;
  employmentId?: string | null;
};

export type SetObservationVisibilityInput = {
  observationId: string;
  visibility: ObservationVisibility;
};

export type UpsertCategoryInput = {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  displayOrder?: number;
};

export type ListObservationsFilter = {
  academicYearId: string;
  studentProfileId?: string;
  termId?: string;
  subjectId?: string;
  categoryCode?: string;
  categoryId?: string;
  employmentId?: string;
  visibility?: ObservationVisibility;
  observedOnFrom?: string;
  observedOnTo?: string;
  classId?: string;
  sectionId?: string;
  includeArchived?: boolean;
  limit?: number;
};

export type QueueAiSummaryInput = {
  studentProfileId: string;
  academicYearId: string;
  termId?: string | null;
  categoryCode?: string | null;
  observationIds?: string[];
};
