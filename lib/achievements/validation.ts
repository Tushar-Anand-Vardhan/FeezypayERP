import {
  ACHIEVEMENT_VISIBILITIES,
  CERTIFICATE_STATUSES,
  type ListAchievementsFilter,
  type QueueAchievementAiSummaryInput,
  type RecordFromEventInput,
  type RecordManualAchievementInput,
  type UpdateAchievementOutcomesInput,
} from "@/lib/achievements/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

export function visibilityFlags(visibility: string): {
  visible_to_guardians: boolean;
  visible_to_students: boolean;
} {
  return {
    visible_to_guardians:
      visibility === "parent_visible" || visibility === "school",
    visible_to_students: visibility === "school",
  };
}

export function validateRecordFromEventInput(
  input: RecordFromEventInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.eventParticipantId?.trim()) {
    errors.eventParticipantId = "Event participant is required.";
  }
  if (
    input.visibility &&
    !ACHIEVEMENT_VISIBILITIES.includes(input.visibility)
  ) {
    errors.visibility = "Invalid visibility.";
  }
  if (input.points != null && (Number.isNaN(input.points) || input.points < 0)) {
    errors.points = "Points must be ≥ 0.";
  }
  return errors;
}

export function validateManualAchievementInput(
  input: RecordManualAchievementInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.studentProfileId?.trim()) {
    errors.studentProfileId = "Student is required.";
  }
  if (!input.title?.trim()) {
    errors.title = "Title is required.";
  }
  if (input.awardedOn && !isValidDate(input.awardedOn)) {
    errors.awardedOn = "Awarded date must be YYYY-MM-DD.";
  }
  if (
    input.visibility &&
    !ACHIEVEMENT_VISIBILITIES.includes(input.visibility)
  ) {
    errors.visibility = "Invalid visibility.";
  }
  if (
    input.certificateStatus &&
    !CERTIFICATE_STATUSES.includes(input.certificateStatus)
  ) {
    errors.certificateStatus = "Invalid certificate status.";
  }
  if (input.points != null && (Number.isNaN(input.points) || input.points < 0)) {
    errors.points = "Points must be ≥ 0.";
  }
  return errors;
}

export function validateUpdateOutcomesInput(
  input: UpdateAchievementOutcomesInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.achievementId?.trim()) {
    errors.achievementId = "Achievement id is required.";
  }
  if (input.awardedOn && !isValidDate(input.awardedOn)) {
    errors.awardedOn = "Awarded date must be YYYY-MM-DD.";
  }
  if (
    input.visibility &&
    !ACHIEVEMENT_VISIBILITIES.includes(input.visibility)
  ) {
    errors.visibility = "Invalid visibility.";
  }
  if (
    input.certificateStatus &&
    !CERTIFICATE_STATUSES.includes(input.certificateStatus)
  ) {
    errors.certificateStatus = "Invalid certificate status.";
  }
  if (input.points != null && (Number.isNaN(input.points) || input.points < 0)) {
    errors.points = "Points must be ≥ 0.";
  }
  return errors;
}

export function validateListFilter(
  input: ListAchievementsFilter,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.awardedOnFrom && !isValidDate(input.awardedOnFrom)) {
    errors.awardedOnFrom = "Invalid from date.";
  }
  if (input.awardedOnTo && !isValidDate(input.awardedOnTo)) {
    errors.awardedOnTo = "Invalid to date.";
  }
  return errors;
}

export function validateQueueAiSummaryInput(
  input: QueueAchievementAiSummaryInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.studentProfileId?.trim()) {
    errors.studentProfileId = "Student is required.";
  }
  return errors;
}

/** Event SoT fields must not be invented on achievements. */
export function mustNotDuplicateEventSot(): string[] {
  return ["event_title", "event_starts_at", "event_description"];
}
