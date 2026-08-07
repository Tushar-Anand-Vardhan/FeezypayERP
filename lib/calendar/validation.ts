import {
  CALENDAR_EVENT_CATEGORIES,
  type CalendarEventInput,
  type HolidayInput,
  type TermInput,
  type WorkingDayPatternInput,
} from "@/lib/calendar/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) {
    return false;
  }
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export function validateWorkingDayPattern(
  input: WorkingDayPatternInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const anyDay =
    input.monday ||
    input.tuesday ||
    input.wednesday ||
    input.thursday ||
    input.friday ||
    input.saturday ||
    input.sunday;

  if (!anyDay) {
    errors.form = "Select at least one working day.";
  }

  return errors;
}

export function trimTermInput(input: TermInput): TermInput {
  return {
    id: input.id,
    academicYearId: input.academicYearId.trim(),
    name: input.name.trim(),
    startDate: input.startDate.trim(),
    endDate: input.endDate.trim(),
    startMonth: input.startMonth ?? null,
    startDay: input.startDay ?? null,
    endMonth: input.endMonth ?? null,
    endDay: input.endDay ?? null,
  };
}

export function validateTermInput(input: TermInput): Record<string, string> {
  const trimmed = trimTermInput(input);
  const errors: Record<string, string> = {};

  if (!trimmed.academicYearId) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!trimmed.name) {
    errors.name = "Term name is required.";
  }
  if (!isIsoDate(trimmed.startDate)) {
    errors.startDate = "Start date must be YYYY-MM-DD.";
  }
  if (!isIsoDate(trimmed.endDate)) {
    errors.endDate = "End date must be YYYY-MM-DD.";
  }
  if (
    isIsoDate(trimmed.startDate) &&
    isIsoDate(trimmed.endDate) &&
    trimmed.endDate < trimmed.startDate
  ) {
    errors.endDate = "End date cannot be before start date.";
  }

  return errors;
}

export function trimHolidayInput(input: HolidayInput): HolidayInput {
  return {
    id: input.id,
    academicYearId: input.academicYearId.trim(),
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    startDate: input.startDate.trim(),
    endDate: input.endDate.trim(),
    isAllDay: input.isAllDay ?? true,
  };
}

export function validateHolidayInput(
  input: HolidayInput,
): Record<string, string> {
  const trimmed = trimHolidayInput(input);
  const errors: Record<string, string> = {};

  if (!trimmed.academicYearId) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!trimmed.title) {
    errors.title = "Title is required.";
  }
  if (!isIsoDate(trimmed.startDate)) {
    errors.startDate = "Start date must be YYYY-MM-DD.";
  }
  if (!isIsoDate(trimmed.endDate)) {
    errors.endDate = "End date must be YYYY-MM-DD.";
  }
  if (
    isIsoDate(trimmed.startDate) &&
    isIsoDate(trimmed.endDate) &&
    trimmed.endDate < trimmed.startDate
  ) {
    errors.endDate = "End date cannot be before start date.";
  }

  return errors;
}

export function trimCalendarEventInput(
  input: CalendarEventInput,
): CalendarEventInput {
  return {
    ...input,
    academicYearId: input.academicYearId.trim(),
    termId: input.termId?.trim() || null,
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    location: input.location?.trim() ?? "",
    startsAt: input.startsAt.trim(),
    endsAt: input.endsAt.trim(),
    audience: {
      classIds: input.audience?.classIds ?? [],
      sectionIds: input.audience?.sectionIds ?? [],
      roleKeys: input.audience?.roleKeys ?? [],
    },
  };
}

export function validateCalendarEventInput(
  input: CalendarEventInput,
): Record<string, string> {
  const trimmed = trimCalendarEventInput(input);
  const errors: Record<string, string> = {};

  if (!trimmed.academicYearId) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!trimmed.title) {
    errors.title = "Title is required.";
  }
  if (!CALENDAR_EVENT_CATEGORIES.includes(trimmed.category)) {
    errors.category = "Select a valid category.";
  }

  const start = new Date(trimmed.startsAt);
  const end = new Date(trimmed.endsAt);
  if (Number.isNaN(start.getTime())) {
    errors.startsAt = "Start date/time is invalid.";
  }
  if (Number.isNaN(end.getTime())) {
    errors.endsAt = "End date/time is invalid.";
  }
  if (
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    end < start
  ) {
    errors.endsAt = "End cannot be before start.";
  }

  const visibility = trimmed.visibility ?? "school";
  if (
    !["school", "staff", "students", "parents", "custom"].includes(visibility)
  ) {
    errors.visibility = "Invalid visibility.";
  }

  const status = trimmed.approvalStatus ?? "draft";
  if (
    ![
      "draft",
      "pending",
      "approved",
      "rejected",
      "published",
      "cancelled",
      "completed",
    ].includes(status)
  ) {
    errors.approvalStatus = "Invalid approval status.";
  }

  return errors;
}
