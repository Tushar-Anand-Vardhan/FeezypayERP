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
  name: string;
  startTime: string;
  endTime: string;
  educational: boolean;
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

export function isEducationalPeriod(input: {
  educational?: boolean | null;
  kind?: string | null;
  periodKind?: string | null;
  isBreak?: boolean | null;
}): boolean {
  if (typeof input.educational === "boolean") {
    return input.educational;
  }
  const kind = input.kind ?? input.periodKind;
  if (kind === "break") return false;
  if (kind === "teaching" || kind === "class_teacher") return true;
  if (input.isBreak) return false;
  return true;
}

export function normalizePeriodRow(
  row: Partial<PeriodFormRow> & {
    kind?: string | null;
    periodKind?: string | null;
    isBreak?: boolean | null;
  },
  index: number,
): PeriodFormRow {
  const educational = isEducationalPeriod(row);
  const periodNumber =
    Number.isInteger(row.periodNumber) && (row.periodNumber as number) >= 0
      ? (row.periodNumber as number)
      : index;
  const fallbackName = educational
    ? `Period ${periodNumber || index + 1}`
    : "Break";
  return {
    periodNumber,
    name: (row.name ?? "").trim() || fallbackName,
    startTime: row.startTime ?? "08:00",
    endTime: row.endTime ?? "09:00",
    educational,
  };
}

export function normalizePeriodRows(
  rows: Array<
    Partial<PeriodFormRow> & {
      kind?: string | null;
      periodKind?: string | null;
      isBreak?: boolean | null;
    }
  >,
): PeriodFormRow[] {
  return rows.map((row, index) => normalizePeriodRow(row, index));
}

function formatTime(hours: number, minutes: number) {
  const wrapped = ((hours * 60 + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const extraHours = Math.floor(((m || 0) + minutes) / 60);
  return formatTime((h || 0) + extraHours, ((m || 0) + minutes) % 60);
}

export function nextPeriodNumber(periods: PeriodFormRow[]) {
  return periods.reduce((max, period) => Math.max(max, period.periodNumber), -1) + 1;
}

export function educationalOrdinal(
  period: PeriodFormRow,
  periods: PeriodFormRow[],
): number | null {
  if (!period.educational) return null;
  let ordinal = 0;
  for (const row of periods) {
    if (!row.educational) continue;
    ordinal += 1;
    if (row.periodNumber === period.periodNumber) {
      return ordinal;
    }
  }
  return null;
}

export function periodCsvToken(period: PeriodFormRow, periods: PeriodFormRow[]) {
  return period.name.trim() || String(educationalOrdinal(period, periods) ?? period.periodNumber);
}

export function periodDisplayLabel(period: PeriodFormRow) {
  return period.name.trim() || (period.educational ? "Period" : "Break");
}

export function createPeriodRow(
  periods: PeriodFormRow[],
  educational: boolean,
): PeriodFormRow {
  const last = periods[periods.length - 1];
  const startTime = last?.endTime ?? "08:00";
  const educationalCount = periods.filter((row) => row.educational).length;
  const breakCount = periods.filter((row) => !row.educational).length;
  return {
    periodNumber: nextPeriodNumber(periods),
    name: educational
      ? `Period ${educationalCount + 1}`
      : breakCount === 0
        ? "Lunch"
        : `Break ${breakCount + 1}`,
    startTime,
    endTime: addMinutes(startTime, educational ? 40 : 30),
    educational,
  };
}

/** Starter day: homeroom, teaching blocks, lunch — all custom-renameable. */
export function defaultDayStructure(): PeriodFormRow[] {
  return [
    {
      periodNumber: 0,
      name: "Class teacher",
      startTime: "07:40",
      endTime: "08:00",
      educational: true,
    },
    {
      periodNumber: 1,
      name: "Period 1",
      startTime: "08:00",
      endTime: "08:40",
      educational: true,
    },
    {
      periodNumber: 2,
      name: "Period 2",
      startTime: "08:40",
      endTime: "09:20",
      educational: true,
    },
    {
      periodNumber: 3,
      name: "Period 3",
      startTime: "09:20",
      endTime: "10:00",
      educational: true,
    },
    {
      periodNumber: 4,
      name: "Period 4",
      startTime: "10:00",
      endTime: "10:40",
      educational: true,
    },
    {
      periodNumber: 5,
      name: "Lunch",
      startTime: "10:40",
      endTime: "11:20",
      educational: false,
    },
    {
      periodNumber: 6,
      name: "Period 5",
      startTime: "11:20",
      endTime: "12:00",
      educational: true,
    },
    {
      periodNumber: 7,
      name: "Period 6",
      startTime: "12:00",
      endTime: "12:40",
      educational: true,
    },
  ];
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
}

export function resolvePeriodFromCsv(
  value: string,
  periods: PeriodFormRow[],
): PeriodFormRow | null {
  const raw = value.trim();
  if (!raw) return null;
  const key = normalizeKey(raw);

  const byName = periods.filter((period) => normalizeKey(period.name) === key);
  if (byName.length === 1) return byName[0];

  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    const byNumber = periods.filter((period) => period.periodNumber === numeric);
    if (byNumber.length === 1) return byNumber[0];
    const educational = periods.filter((period) => period.educational);
    if (numeric >= 1 && numeric <= educational.length) {
      return educational[numeric - 1];
    }
  }

  return null;
}

export function validateTimetableForm(input: {
  periods: PeriodFormRow[];
  requireConfigured?: boolean;
}): TimetableFieldErrors {
  const errors: TimetableFieldErrors = {};
  const periods = normalizePeriodRows(input.periods);

  if (input.requireConfigured && periods.length === 0) {
    errors.form = "Add at least one period, or skip for now.";
    return errors;
  }

  const seenNumbers = new Map<number, number>();
  const seenNames = new Map<string, number>();
  periods.forEach((period, index) => {
    if (!period.name.trim()) {
      errors[`period-${index}`] = "Name this period (for example Period 1 or Lunch).";
      return;
    }
    const nameKey = normalizeKey(period.name);
    const previousName = seenNames.get(nameKey);
    if (previousName != null) {
      errors[`period-${index}`] = "Period names must be unique.";
      return;
    }
    seenNames.set(nameKey, index);

    if (!Number.isInteger(period.periodNumber) || period.periodNumber < 0) {
      errors[`period-${index}`] = "Period number must be 0 or greater.";
      return;
    }
    const previous = seenNumbers.get(period.periodNumber);
    if (previous != null) {
      errors[`period-${index}`] = "Period numbers must be unique.";
      return;
    }
    seenNumbers.set(period.periodNumber, index);
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
