export const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

export type PeriodFormRow = {
  periodNumber: number;
  startTime: string;
  endTime: string;
};

export type TimetableSlotFormRow = {
  sectionId: string;
  dayOfWeek: number;
  periodNumber: number;
  subjectId: string;
  teacherId: string;
};

export type ClassTeacherAssignment = {
  sectionId: string;
  teacherId: string;
};

export type TimetableFieldErrors = Record<string, string>;

export function defaultPeriods(count: number): PeriodFormRow[] {
  const startHour = 8;
  return Array.from({ length: count }, (_, index) => {
    const start = startHour + index;
    const end = start + 1;
    return {
      periodNumber: index + 1,
      startTime: `${String(start).padStart(2, "0")}:00`,
      endTime: `${String(end).padStart(2, "0")}:00`,
    };
  });
}

export function validateTimetableForm(input: {
  periods: PeriodFormRow[];
  requireConfigured?: boolean;
}): TimetableFieldErrors {
  const errors: TimetableFieldErrors = {};
  if (input.requireConfigured && input.periods.length === 0) {
    errors.form = "Add at least one period, or skip for now.";
    return errors;
  }

  input.periods.forEach((period, index) => {
    if (!period.startTime || !period.endTime) {
      errors[`period-${index}`] = "Start and end times are required.";
      return;
    }
    if (period.endTime <= period.startTime) {
      errors[`period-${index}`] = "End time must be after start time.";
    }
  });

  return errors;
}
