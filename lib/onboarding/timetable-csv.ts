import { parseCsv } from "@/lib/onboarding/csv";
import {
  WEEKDAYS,
  periodDisplayLabel,
  periodCsvToken,
  resolvePeriodFromCsv,
  type PeriodFormRow,
  type TimetableSlotFormRow,
} from "@/lib/onboarding/timetable";
import {
  normalizeClassToken,
  normalizeSectionToken,
} from "@/lib/onboarding/students";

export const TIMETABLE_CSV_HEADERS = [
  "class",
  "section",
  "day",
  "period",
  "subject",
  "teacher",
] as const;

export const TIMETABLE_CSV_TEMPLATE_HEADERS = [
  "class",
  "section",
  "day",
  "period",
  "start",
  "end",
  "educational",
  "subject",
  "teacher",
] as const;

export type TimetableCsvCatalog = {
  section: { id: string; name: string; className: string };
  periods: PeriodFormRow[];
  subjects: Array<{ id: string; name: string }>;
  teachers: Array<{ id: string; name: string; employeeCode: string }>;
};

export type ApplyTimetableCsvResult =
  | { ok: true; slots: TimetableSlotFormRow[]; filledCount: number }
  | { ok: false; errors: string[] };

const DAY_ALIASES: Record<string, number> = {
  mon: 1,
  monday: 1,
  "1": 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  "2": 2,
  wed: 3,
  wednesday: 3,
  "3": 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  "4": 4,
  fri: 5,
  friday: 5,
  "5": 5,
  sat: 6,
  saturday: 6,
  "6": 6,
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
}

function classMatchesCatalog(csvValue: string, catalogValue: string): boolean {
  if (normalizeKey(csvValue) === normalizeKey(catalogValue)) {
    return true;
  }
  const csvToken = normalizeClassToken(csvValue);
  const catalogToken = normalizeClassToken(catalogValue);
  return Boolean(csvToken) && csvToken === catalogToken;
}

function sectionMatchesCatalog(csvValue: string, catalogValue: string): boolean {
  if (normalizeKey(csvValue) === normalizeKey(catalogValue)) {
    return true;
  }
  const csvToken = normalizeSectionToken(csvValue);
  const catalogToken = normalizeSectionToken(catalogValue);
  return Boolean(csvToken) && csvToken === catalogToken;
}

export function parseTimetableDay(value: string): number | null {
  const key = normalizeKey(value);
  return DAY_ALIASES[key] ?? null;
}

export function buildTimetableCsvTemplateRows(input: {
  className: string;
  sectionName: string;
  periods: PeriodFormRow[];
  sampleSubject?: string;
  sampleTeacher?: string;
}): string[][] {
  const samplePeriodNumber = (
    input.periods.find(
      (period) => period.educational && /^period\s*\d+/i.test(period.name),
    ) ?? input.periods.find((period) => period.educational)
  )?.periodNumber;
  const rows: string[][] = [];
  for (const period of input.periods) {
    const periodName = periodCsvToken(period, input.periods) || periodDisplayLabel(period);
    for (const day of WEEKDAYS) {
      const isSample =
        day.value === 1 &&
        period.educational &&
        period.periodNumber === samplePeriodNumber;
      rows.push([
        input.className,
        input.sectionName,
        day.label,
        periodName,
        period.startTime,
        period.endTime,
        period.educational ? "yes" : "no",
        isSample ? (input.sampleSubject ?? "") : "",
        isSample ? (input.sampleTeacher ?? "") : "",
      ]);
    }
  }
  return rows;
}

export function applyTimetableCsv(input: {
  csvText: string;
  catalog: TimetableCsvCatalog;
}): ApplyTimetableCsvResult {
  const parsed = parseCsv(input.csvText);
  const missing = TIMETABLE_CSV_HEADERS.filter(
    (header) => !parsed.headers.includes(header),
  );
  if (missing.length > 0) {
    return {
      ok: false,
      errors: [
        `CSV must include columns: ${TIMETABLE_CSV_HEADERS.join(", ")}.`,
      ],
    };
  }
  if (parsed.rows.length === 0) {
    return { ok: false, errors: ["CSV has no data rows."] };
  }

  const subjectByName = new Map<string, string[]>();
  for (const subject of input.catalog.subjects) {
    const key = normalizeKey(subject.name);
    const ids = subjectByName.get(key) ?? [];
    ids.push(subject.id);
    subjectByName.set(key, ids);
  }

  const teacherByCode = new Map<string, string[]>();
  const teacherByName = new Map<string, string[]>();
  for (const teacher of input.catalog.teachers) {
    if (teacher.employeeCode) {
      const codeKey = normalizeKey(teacher.employeeCode);
      const ids = teacherByCode.get(codeKey) ?? [];
      ids.push(teacher.id);
      teacherByCode.set(codeKey, ids);
    }
    const nameKey = normalizeKey(teacher.name);
    const ids = teacherByName.get(nameKey) ?? [];
    ids.push(teacher.id);
    teacherByName.set(nameKey, ids);
  }

  const errors: string[] = [];
  const byCell = new Map<string, TimetableSlotFormRow>();
  const tokens = input.catalog.periods
    .map((period) => periodCsvToken(period, input.catalog.periods))
    .join(", ");

  parsed.rows.forEach((row, index) => {
    const line = index + 2;
    const className = (row.class ?? "").trim();
    const sectionName = (row.section ?? "").trim();
    const dayRaw = (row.day ?? "").trim();
    const periodRaw = (row.period ?? "").trim();
    const subjectName = (row.subject ?? "").trim();
    const teacherValue = (row.teacher ?? "").trim();

    if (!classMatchesCatalog(className, input.catalog.section.className)) {
      errors.push(
        `Row ${line}: class "${className || "(blank)"}" does not match ${input.catalog.section.className}. Short forms like "6" for "Class 6" are OK.`,
      );
      return;
    }
    if (!sectionMatchesCatalog(sectionName, input.catalog.section.name)) {
      errors.push(
        `Row ${line}: section "${sectionName || "(blank)"}" does not match ${input.catalog.section.name}.`,
      );
      return;
    }

    const dayOfWeek = parseTimetableDay(dayRaw);
    if (dayOfWeek === null) {
      errors.push(
        `Row ${line}: day "${dayRaw || "(blank)"}" must be Mon–Sat (or 1–6).`,
      );
      return;
    }

    const period = resolvePeriodFromCsv(periodRaw, input.catalog.periods);
    if (!period) {
      errors.push(
        `Row ${line}: period "${periodRaw || "(blank)"}" must match a day-structure row (${tokens}).`,
      );
      return;
    }

    if (!period.educational && subjectName) {
      errors.push(
        `Row ${line}: "${period.name}" is not educational. Leave subject blank; teacher is optional.`,
      );
      return;
    }

    const cellKey = `${dayOfWeek}-${period.periodNumber}`;
    if (byCell.has(cellKey)) {
      errors.push(
        `Row ${line}: duplicate slot for ${dayRaw} period ${periodRaw}.`,
      );
      return;
    }

    let subjectId = "";
    if (subjectName) {
      const matches = subjectByName.get(normalizeKey(subjectName)) ?? [];
      if (matches.length === 0) {
        errors.push(
          `Row ${line}: unknown subject "${subjectName}". Use a subject already added for this school.`,
        );
        return;
      }
      if (matches.length > 1) {
        errors.push(
          `Row ${line}: subject "${subjectName}" matches more than one catalog entry.`,
        );
        return;
      }
      subjectId = matches[0];
    }

    let teacherId = "";
    if (teacherValue) {
      const codeMatches = teacherByCode.get(normalizeKey(teacherValue)) ?? [];
      const nameMatches = teacherByName.get(normalizeKey(teacherValue)) ?? [];
      const matches = codeMatches.length > 0 ? codeMatches : nameMatches;
      if (matches.length === 0) {
        errors.push(
          `Row ${line}: unknown teacher "${teacherValue}". Use staff full name or employee code.`,
        );
        return;
      }
      if (matches.length > 1) {
        errors.push(
          `Row ${line}: teacher "${teacherValue}" matches more than one staff member. Use employee_code.`,
        );
        return;
      }
      teacherId = matches[0];
    }

    byCell.set(cellKey, {
      sectionId: input.catalog.section.id,
      dayOfWeek,
      periodNumber: period.periodNumber,
      subjectId,
      teacherId,
    });
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const slots = [...byCell.values()].filter(
    (slot) => slot.subjectId || slot.teacherId,
  );
  return { ok: true, slots, filledCount: slots.length };
}
