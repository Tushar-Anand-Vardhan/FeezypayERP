/** Student Achievement Engine (E35) — types */

export type AchievementActionResult =
  | { success: true; message: string; id?: string; ids?: string[] }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type AchievementSource =
  | "calendar_event"
  | "manual"
  | "competition"
  | "import";

export type AchievementVisibility =
  | "private"
  | "staff"
  | "parent_visible"
  | "school";

export type CertificateStatus = "none" | "pending" | "issued" | "revoked";

export const ACHIEVEMENT_SOURCES: AchievementSource[] = [
  "calendar_event",
  "manual",
  "competition",
  "import",
];

export const ACHIEVEMENT_VISIBILITIES: AchievementVisibility[] = [
  "private",
  "staff",
  "parent_visible",
  "school",
];

export const CERTIFICATE_STATUSES: CertificateStatus[] = [
  "none",
  "pending",
  "issued",
  "revoked",
];

export const ACHIEVEMENT_CATEGORIES = [
  "sports",
  "competition",
  "cultural",
  "academic",
  "service",
  "leadership",
  "club",
  "house",
  "other",
] as const;

export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

export type RecordFromEventInput = {
  eventParticipantId: string;
  /** Override outcome fields; otherwise taken from participant + event */
  points?: number | null;
  remarks?: string | null;
  visibility?: AchievementVisibility;
  photoMediaIds?: string[];
  attachmentMediaIds?: string[];
  employmentId?: string | null;
};

export type RecordManualAchievementInput = {
  studentProfileId: string;
  title: string;
  category?: string;
  academicYearId?: string | null;
  termId?: string | null;
  awardedOn?: string | null;
  description?: string | null;
  participationRole?: string | null;
  attendanceStatus?: string | null;
  awardLabel?: string | null;
  positionLabel?: string | null;
  certificateStatus?: CertificateStatus;
  certificateDocumentId?: string | null;
  points?: number | null;
  remarks?: string | null;
  visibility?: AchievementVisibility;
  photoMediaIds?: string[];
  attachmentMediaIds?: string[];
  employmentId?: string | null;
};

export type UpdateAchievementOutcomesInput = {
  achievementId: string;
  participationRole?: string | null;
  attendanceStatus?: string | null;
  awardLabel?: string | null;
  positionLabel?: string | null;
  certificateStatus?: CertificateStatus;
  certificateDocumentId?: string | null;
  points?: number | null;
  remarks?: string | null;
  visibility?: AchievementVisibility;
  photoMediaIds?: string[];
  attachmentMediaIds?: string[];
  awardedOn?: string | null;
  description?: string | null;
  category?: string;
};

export type ListAchievementsFilter = {
  academicYearId?: string;
  studentProfileId?: string;
  calendarEventId?: string;
  category?: string;
  source?: AchievementSource;
  visibility?: AchievementVisibility;
  awardedOnFrom?: string;
  awardedOnTo?: string;
  includeArchived?: boolean;
  limit?: number;
};

export type QueueAchievementAiSummaryInput = {
  studentProfileId: string;
  academicYearId?: string | null;
  achievementIds?: string[];
};
