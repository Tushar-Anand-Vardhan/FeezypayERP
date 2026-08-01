export type TermFormRow = {
  name: string;
  startDate: string;
  endDate: string;
};

export type TermFieldErrors = Record<string, string>;

export function trimTermRows(rows: TermFormRow[]): TermFormRow[] {
  return rows.map((row) => ({
    name: row.name.trim(),
    startDate: row.startDate.trim(),
    endDate: row.endDate.trim(),
  }));
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
) {
  return startA <= endB && startB <= endA;
}

export function validateTermsForm(rows: TermFormRow[]): TermFieldErrors {
  const trimmed = trimTermRows(rows);
  const errors: TermFieldErrors = {};

  if (trimmed.length < 1) {
    errors.form = "At least one term is required.";
    return errors;
  }

  const parsedRanges: Array<{ index: number; start: Date; end: Date }> = [];

  trimmed.forEach((row, index) => {
    if (!row.name) {
      errors[`term-${index}-name`] = "Term name is required.";
    }

    if (!row.startDate) {
      errors[`term-${index}-startDate`] = "Start date is required.";
    }

    if (!row.endDate) {
      errors[`term-${index}-endDate`] = "End date is required.";
    }

    if (!row.startDate || !row.endDate) {
      return;
    }

    const start = parseDate(row.startDate);
    const end = parseDate(row.endDate);

    if (!start) {
      errors[`term-${index}-startDate`] = "Enter a valid start date.";
      return;
    }

    if (!end) {
      errors[`term-${index}-endDate`] = "Enter a valid end date.";
      return;
    }

    if (end <= start) {
      errors[`term-${index}-endDate`] = "End date must be after start date.";
      return;
    }

    parsedRanges.push({ index, start, end });
  });

  for (let i = 0; i < parsedRanges.length; i += 1) {
    for (let j = i + 1; j < parsedRanges.length; j += 1) {
      const left = parsedRanges[i];
      const right = parsedRanges[j];

      if (rangesOverlap(left.start, left.end, right.start, right.end)) {
        errors[`term-${right.index}-startDate`] =
          "This term overlaps with another term.";
        errors[`term-${left.index}-startDate`] =
          "This term overlaps with another term.";
      }
    }
  }

  return errors;
}
