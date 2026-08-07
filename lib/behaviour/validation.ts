import type {
  BehaviourAnalyticsQuery,
  CreateFollowUpInput,
  CreateRemarkInput,
  UpdateFollowUpInput,
  UpdateRemarkInput,
} from "@/lib/behaviour/types";
import {
  FOLLOW_UP_ACTION_TYPES,
  FOLLOW_UP_ROW_STATUSES,
  INCIDENT_STATUSES,
  REMARK_KINDS,
  REMARK_VISIBILITIES,
  SEVERITIES,
} from "@/lib/behaviour/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

export function visibilityFlags(visibility: string): {
  visible_to_guardians: boolean;
  visible_to_students: boolean;
} {
  const parent = visibility === "parent_visible" || visibility === "school";
  const student = visibility === "school";
  return {
    visible_to_guardians: parent,
    visible_to_students: student,
  };
}

export function defaultSeverityForKind(kind: string): string {
  if (kind === "warning") return "medium";
  if (kind === "disciplinary") return "medium";
  if (kind === "positive" || kind === "commendation") return "low";
  return "low";
}

export function validateCreateRemarkInput(
  input: CreateRemarkInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.studentProfileId?.trim()) {
    errors.studentProfileId = "Student is required.";
  }
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!input.title?.trim()) {
    errors.title = "Title is required.";
  }
  if (!(REMARK_KINDS as string[]).includes(input.remarkKind)) {
    errors.remarkKind = "Invalid remark kind.";
  }
  if (
    input.visibility &&
    !(REMARK_VISIBILITIES as string[]).includes(input.visibility)
  ) {
    errors.visibility = "Invalid visibility.";
  }
  if (input.severity && !(SEVERITIES as string[]).includes(input.severity)) {
    errors.severity = "Invalid severity.";
  }
  if (input.status && !(INCIDENT_STATUSES as string[]).includes(input.status)) {
    errors.status = "Invalid status.";
  }
  if (input.occurredOn && !isValidDate(input.occurredOn)) {
    errors.occurredOn = "Occurred date is invalid.";
  }
  if (input.body && input.body.length > 8000) {
    errors.body = "Body is too long.";
  }
  return errors;
}

export function validateUpdateRemarkInput(
  input: UpdateRemarkInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.id?.trim()) {
    errors.id = "Remark id is required.";
  }
  if (
    input.visibility &&
    !(REMARK_VISIBILITIES as string[]).includes(input.visibility)
  ) {
    errors.visibility = "Invalid visibility.";
  }
  if (input.severity && !(SEVERITIES as string[]).includes(input.severity)) {
    errors.severity = "Invalid severity.";
  }
  if (input.status && !(INCIDENT_STATUSES as string[]).includes(input.status)) {
    errors.status = "Invalid status.";
  }
  if (input.occurredOn && !isValidDate(input.occurredOn)) {
    errors.occurredOn = "Occurred date is invalid.";
  }
  return errors;
}

export function validateCreateFollowUpInput(
  input: CreateFollowUpInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.conductIncidentId?.trim()) {
    errors.conductIncidentId = "Remark/incident is required.";
  }
  if (!input.title?.trim()) {
    errors.title = "Title is required.";
  }
  if (
    input.actionType &&
    !(FOLLOW_UP_ACTION_TYPES as string[]).includes(input.actionType)
  ) {
    errors.actionType = "Invalid follow-up action type.";
  }
  if (input.dueOn && !isValidDate(input.dueOn)) {
    errors.dueOn = "Due date is invalid.";
  }
  return errors;
}

export function validateUpdateFollowUpInput(
  input: UpdateFollowUpInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.id?.trim()) {
    errors.id = "Follow-up id is required.";
  }
  if (
    input.status &&
    !(FOLLOW_UP_ROW_STATUSES as string[]).includes(input.status)
  ) {
    errors.status = "Invalid follow-up status.";
  }
  if (input.dueOn && !isValidDate(input.dueOn)) {
    errors.dueOn = "Due date is invalid.";
  }
  return errors;
}

export function validateAnalyticsQuery(
  input: BehaviourAnalyticsQuery,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (
    input.remarkKind &&
    !(REMARK_KINDS as string[]).includes(input.remarkKind)
  ) {
    errors.remarkKind = "Invalid remark kind.";
  }
  return errors;
}
