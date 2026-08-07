import {
  OBSERVATION_VISIBILITIES,
  type ListObservationsFilter,
  type QueueAiSummaryInput,
  type RecordObservationInput,
  type SetObservationVisibilityInput,
  type SupersedeObservationInput,
  type UpsertCategoryInput,
} from "@/lib/observations/types";

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

export function validateRecordObservationInput(
  input: RecordObservationInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.studentProfileId?.trim()) {
    errors.studentProfileId = "Student is required.";
  }
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!input.categoryId?.trim() && !input.categoryCode?.trim()) {
    errors.category = "Category is required.";
  }
  if (!input.remark?.trim()) {
    errors.remark = "Remark is required.";
  } else if (input.remark.trim().length > 8000) {
    errors.remark = "Remark is too long (max 8000).";
  }
  if (!input.observedOn?.trim() || !isValidDate(input.observedOn.trim())) {
    errors.observedOn = "Observed date is required (YYYY-MM-DD).";
  }
  if (
    input.visibility &&
    !OBSERVATION_VISIBILITIES.includes(input.visibility)
  ) {
    errors.visibility = "Invalid visibility.";
  }
  return errors;
}

export function validateSupersedeObservationInput(
  input: SupersedeObservationInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.observationId?.trim()) {
    errors.observationId = "Observation id is required.";
  }
  if (!input.remark?.trim()) {
    errors.remark = "Remark is required.";
  } else if (input.remark.trim().length > 8000) {
    errors.remark = "Remark is too long (max 8000).";
  }
  if (input.observedOn && !isValidDate(input.observedOn.trim())) {
    errors.observedOn = "Observed date must be YYYY-MM-DD.";
  }
  if (
    input.visibility &&
    !OBSERVATION_VISIBILITIES.includes(input.visibility)
  ) {
    errors.visibility = "Invalid visibility.";
  }
  return errors;
}

export function validateSetVisibilityInput(
  input: SetObservationVisibilityInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.observationId?.trim()) {
    errors.observationId = "Observation id is required.";
  }
  if (!OBSERVATION_VISIBILITIES.includes(input.visibility)) {
    errors.visibility = "Invalid visibility.";
  }
  return errors;
}

export function validateUpsertCategoryInput(
  input: UpsertCategoryInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.code?.trim()) {
    errors.code = "Code is required.";
  } else if (!/^[a-z][a-z0-9_]{1,63}$/.test(input.code.trim())) {
    errors.code = "Code must be snake_case starting with a letter.";
  }
  if (!input.name?.trim()) {
    errors.name = "Name is required.";
  }
  return errors;
}

export function validateListFilter(
  input: ListObservationsFilter,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (input.observedOnFrom && !isValidDate(input.observedOnFrom)) {
    errors.observedOnFrom = "Invalid from date.";
  }
  if (input.observedOnTo && !isValidDate(input.observedOnTo)) {
    errors.observedOnTo = "Invalid to date.";
  }
  return errors;
}

export function validateQueueAiSummaryInput(
  input: QueueAiSummaryInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.studentProfileId?.trim()) {
    errors.studentProfileId = "Student is required.";
  }
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  return errors;
}

/** Append-only: remark body must never be updated in place. */
export function mayUpdateRemarkBody(): boolean {
  return false;
}
