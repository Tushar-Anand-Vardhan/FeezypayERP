export const EXAM_CATEGORIES = [
  { value: "unit_test", label: "Unit test" },
  { value: "quiz", label: "Quiz" },
  { value: "midterm", label: "Midterm" },
  { value: "final", label: "Final" },
  { value: "oral", label: "Oral" },
  { value: "project", label: "Project" },
] as const;

export const GRADING_TYPES = [
  { value: "marks", label: "Marks" },
  { value: "letter_grade", label: "Letter grade" },
  { value: "rubric", label: "Rubric" },
] as const;

export type ExamFormRow = {
  classId: string;
  name: string;
  category: (typeof EXAM_CATEGORIES)[number]["value"];
  termId: string;
  weightagePercent: string;
  maxMarks: string;
  gradingType: (typeof GRADING_TYPES)[number]["value"];
};

export type ExamFieldErrors = Record<string, string>;

export function emptyExam(overrides: Partial<ExamFormRow> = {}): ExamFormRow {
  return {
    classId: "",
    name: "",
    category: "unit_test",
    termId: "",
    weightagePercent: "",
    maxMarks: "100",
    gradingType: "marks",
    ...overrides,
  };
}

export function trimExamRows(rows: ExamFormRow[]): ExamFormRow[] {
  return rows.map((row) => ({
    ...row,
    classId: row.classId.trim(),
    name: row.name.trim(),
    weightagePercent: row.weightagePercent.trim(),
    maxMarks: row.maxMarks.trim(),
  }));
}

export function copyExamsToClass(
  rows: ExamFormRow[],
  sourceClassId: string,
  targetClassId: string,
): ExamFormRow[] {
  const copies = rows
    .filter((row) => row.classId === sourceClassId)
    .map((row) => ({ ...row, classId: targetClassId }));
  return [
    ...rows.filter((row) => row.classId !== targetClassId),
    ...copies,
  ];
}

export function validateExamRows(
  rows: ExamFormRow[],
  options: { requireAtLeastOne?: boolean; classIds?: Set<string> } = {},
): ExamFieldErrors {
  const errors: ExamFieldErrors = {};
  const trimmed = trimExamRows(rows);

  if (options.requireAtLeastOne && trimmed.length === 0) {
    errors.form = "Add at least one exam definition before continuing.";
    return errors;
  }

  const seen = new Map<string, number>();
  trimmed.forEach((row, index) => {
    if (!row.classId) {
      errors[`exam-${index}-classId`] = "Select a class.";
    } else if (options.classIds && !options.classIds.has(row.classId)) {
      errors[`exam-${index}-classId`] = "Class is not in this academic year.";
    }
    if (!row.name) {
      errors[`exam-${index}-name`] = "Exam name is required.";
    } else {
      const key = `${row.classId}::${row.name.toLowerCase()}`;
      if (seen.has(key)) {
        errors[`exam-${index}-name`] =
          "Duplicate exam name for this class.";
      } else {
        seen.set(key, index);
      }
    }
    if (!row.termId) {
      errors[`exam-${index}-termId`] = "Select a term.";
    }
    if (row.weightagePercent) {
      const value = Number(row.weightagePercent);
      if (Number.isNaN(value) || value < 0 || value > 100) {
        errors[`exam-${index}-weightagePercent`] =
          "Weightage must be between 0 and 100.";
      }
    }
    if (row.maxMarks) {
      const value = Number(row.maxMarks);
      if (Number.isNaN(value) || value <= 0) {
        errors[`exam-${index}-maxMarks`] = "Max marks must be a positive number.";
      }
    }
  });

  return errors;
}
