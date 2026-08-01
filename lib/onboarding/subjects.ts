export type SubjectType = "scholastic" | "co_scholastic";

export type SubjectFormRow = {
  name: string;
  code: string;
  type: SubjectType;
};

export type ClassSubjectAssignmentRow = {
  subjectName: string;
  isElective: boolean;
};

export type ClassSubjectAssignmentsFormRow = {
  classId: string;
  assignedSubjects: ClassSubjectAssignmentRow[];
};

export type SubjectFieldErrors = Record<string, string>;

export const SUBJECT_TYPES: SubjectType[] = ["scholastic", "co_scholastic"];

export function trimSubjectRows(rows: SubjectFormRow[]): SubjectFormRow[] {
  return rows.map((row) => ({
    name: row.name.trim(),
    code: row.code.trim(),
    type: row.type,
  }));
}

export function validateSubjects(
  rows: SubjectFormRow[],
  options: { requireAtLeastOne?: boolean } = {},
): SubjectFieldErrors {
  const errors: SubjectFieldErrors = {};
  const trimmed = trimSubjectRows(rows);

  if (options.requireAtLeastOne && trimmed.length === 0) {
    errors.form = "Add at least one subject.";
    return errors;
  }

  const seen = new Map<string, number>();

  trimmed.forEach((row, index) => {
    if (!row.name) {
      errors[`subject-${index}-name`] = "Subject name is required.";
      return;
    }

    if (!SUBJECT_TYPES.includes(row.type)) {
      errors[`subject-${index}-type`] = "Select a valid subject type.";
      return;
    }

    const key = row.name.toLowerCase();
    const firstIndex = seen.get(key);

    if (firstIndex !== undefined) {
      errors[`subject-${index}-name`] = "This subject name duplicates another.";
      errors[`subject-${firstIndex}-name`] = "This subject name duplicates another.";
      return;
    }

    seen.set(key, index);
  });

  return errors;
}

export function validateClassSubjectAssignments(
  subjects: SubjectFormRow[],
  classAssignments: ClassSubjectAssignmentsFormRow[],
): SubjectFieldErrors {
  const errors: SubjectFieldErrors = {};
  const subjectNames = new Map(
    trimSubjectRows(subjects).map((row) => [row.name.toLowerCase(), row.name]),
  );

  for (const classRow of classAssignments) {
    const seen = new Set<string>();

    for (const assignment of classRow.assignedSubjects) {
      const normalizedName = assignment.subjectName.trim().toLowerCase();
      if (!normalizedName) {
        continue;
      }

      if (!subjectNames.has(normalizedName)) {
        errors[`class-${classRow.classId}-assignments`] =
          "One or more assigned subjects are not in your catalog.";
        continue;
      }

      if (seen.has(normalizedName)) {
        errors[`class-${classRow.classId}-assignments`] =
          "Each subject can only be assigned once per class.";
        continue;
      }

      seen.add(normalizedName);
    }
  }

  return errors;
}
