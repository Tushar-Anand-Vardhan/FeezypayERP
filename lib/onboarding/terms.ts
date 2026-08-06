import { MONTH_OPTIONS } from "@/lib/onboarding/school-identity";

export type TermFormRow = {
  name: string;
  startMonth: string;
  startDay: string;
  endMonth: string;
  endDay: string;
};

export type TermFieldErrors = Record<string, string>;

export function trimTermRows(rows: TermFormRow[]): TermFormRow[] {
  return rows.map((row) => ({
    name: row.name.trim(),
    startMonth: row.startMonth.trim(),
    startDay: row.startDay.trim(),
    endMonth: row.endMonth.trim(),
    endDay: row.endDay.trim(),
  }));
}

export function daysInMonth(month: number, year = 2024): number {
  return new Date(year, month, 0).getDate();
}

export function parseAcademicYearStartYear(label: string): number | null {
  const match = /^(\d{4})-\d{2}$/.exec(label.trim());
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

/** Absolute date for a month/day within an academic year cycle. */
export function materializeTermDate(
  month: number,
  day: number,
  academicYearStartMonth: number,
  academicYearStartYear: number,
): Date {
  const year =
    month >= academicYearStartMonth
      ? academicYearStartYear
      : academicYearStartYear + 1;
  return new Date(year, month - 1, day);
}

export function formatMonthDayLabel(month: number, day: number): string {
  const monthLabel =
    MONTH_OPTIONS.find((option) => option.value === month)?.label ??
    String(month);
  return `${monthLabel} ${day}`;
}

export function validateTermsForm(
  rows: TermFormRow[],
  academicYearStartMonth: number,
): TermFieldErrors {
  const trimmed = trimTermRows(rows);
  const errors: TermFieldErrors = {};

  if (trimmed.length < 1) {
    errors.form = "At least one term is required.";
    return errors;
  }

  if (
    !Number.isInteger(academicYearStartMonth) ||
    academicYearStartMonth < 1 ||
    academicYearStartMonth > 12
  ) {
    errors.form = "Set your academic year start month in School Identity first.";
    return errors;
  }

  type ParsedTerm = {
    index: number;
    start: Date;
    end: Date;
    startMonth: number;
  };

  const parsed: ParsedTerm[] = [];
  // Use a leap year so Feb 29 is accepted as a recurring day.
  const referenceStartYear = 2024;

  trimmed.forEach((row, index) => {
    if (!row.name) {
      errors[`term-${index}-name`] = "Term name is required.";
    }

    const startMonth = Number(row.startMonth);
    const startDay = Number(row.startDay);
    const endMonth = Number(row.endMonth);
    const endDay = Number(row.endDay);

    if (!row.startMonth || Number.isNaN(startMonth) || startMonth < 1 || startMonth > 12) {
      errors[`term-${index}-startMonth`] = "Start month is required.";
    }
    if (!row.startDay || Number.isNaN(startDay) || startDay < 1 || startDay > 31) {
      errors[`term-${index}-startDay`] = "Start day is required.";
    } else if (
      !Number.isNaN(startMonth) &&
      startMonth >= 1 &&
      startMonth <= 12 &&
      startDay > daysInMonth(startMonth)
    ) {
      errors[`term-${index}-startDay`] = "Enter a valid day for that month.";
    }

    if (!row.endMonth || Number.isNaN(endMonth) || endMonth < 1 || endMonth > 12) {
      errors[`term-${index}-endMonth`] = "End month is required.";
    }
    if (!row.endDay || Number.isNaN(endDay) || endDay < 1 || endDay > 31) {
      errors[`term-${index}-endDay`] = "End day is required.";
    } else if (
      !Number.isNaN(endMonth) &&
      endMonth >= 1 &&
      endMonth <= 12 &&
      endDay > daysInMonth(endMonth)
    ) {
      errors[`term-${index}-endDay`] = "Enter a valid day for that month.";
    }

    if (
      errors[`term-${index}-startMonth`] ||
      errors[`term-${index}-startDay`] ||
      errors[`term-${index}-endMonth`] ||
      errors[`term-${index}-endDay`]
    ) {
      return;
    }

    const start = materializeTermDate(
      startMonth,
      startDay,
      academicYearStartMonth,
      referenceStartYear,
    );
    const end = materializeTermDate(
      endMonth,
      endDay,
      academicYearStartMonth,
      referenceStartYear,
    );

    if (end <= start) {
      errors[`term-${index}-endDay`] =
        "End must be after start within the academic year.";
      return;
    }

    parsed.push({ index, start, end, startMonth });
  });

  if (parsed.length > 0) {
    const earliest = parsed.reduce((min, term) =>
      term.start < min.start ? term : min,
    );

    if (earliest.startMonth !== academicYearStartMonth) {
      const monthLabel =
        MONTH_OPTIONS.find((option) => option.value === academicYearStartMonth)
          ?.label ?? String(academicYearStartMonth);
      errors[`term-${earliest.index}-startMonth`] =
        `The first term must start in ${monthLabel}, your academic year start month.`;
    }
  }

  for (let i = 0; i < parsed.length; i += 1) {
    for (let j = i + 1; j < parsed.length; j += 1) {
      const left = parsed[i];
      const right = parsed[j];

      if (left.start <= right.end && right.start <= left.end) {
        errors[`term-${right.index}-startMonth`] =
          "This term overlaps with another term.";
        errors[`term-${left.index}-startMonth`] =
          "This term overlaps with another term.";
      }
    }
  }

  return errors;
}
