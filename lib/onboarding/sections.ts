export type SectionFormRow = {
  name: string;
};

export type ClassSectionsFormRow = {
  classId: string;
  capacity: string;
  sections: SectionFormRow[];
};

export type SectionFieldErrors = Record<string, string>;

export function trimSectionRows(rows: SectionFormRow[]): SectionFormRow[] {
  return rows.map((row) => ({
    name: row.name.trim(),
  }));
}

export function parseBulkSectionNames(rawValue: string): string[] {
  return rawValue
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function applyBulkSectionsToEmptyClasses(
  classes: ClassSectionsFormRow[],
  sectionNames: string[],
): ClassSectionsFormRow[] {
  const names = sectionNames.map((name) => name.trim()).filter(Boolean);

  return classes.map((classRow) => {
    if (classRow.sections.length > 0) {
      return classRow;
    }

    return {
      ...classRow,
      sections: names.map((name) => ({ name })),
    };
  });
}

export function validateSectionsByClass(
  classes: ClassSectionsFormRow[],
  options: { requireEveryClassHasSection?: boolean } = {},
): SectionFieldErrors {
  const errors: SectionFieldErrors = {};

  for (const classRow of classes) {
    const trimmedSections = trimSectionRows(classRow.sections);
    const trimmedCapacity = classRow.capacity.trim();

    if (options.requireEveryClassHasSection && trimmedSections.length === 0) {
      errors[`class-${classRow.classId}-form`] =
        "Add at least one section for this class.";
    }

    if (trimmedCapacity) {
      const capacity = Number(trimmedCapacity);
      if (!Number.isInteger(capacity) || capacity <= 0) {
        errors[`class-${classRow.classId}-capacity`] =
          "Capacity must be a positive integer.";
      }
    }

    const seen = new Map<string, number>();

    trimmedSections.forEach((section, index) => {
      if (!section.name) {
        errors[`class-${classRow.classId}-section-${index}-name`] =
          "Section name cannot be empty.";
        return;
      }

      const key = section.name.toLowerCase();
      const firstIndex = seen.get(key);

      if (firstIndex !== undefined) {
        errors[`class-${classRow.classId}-section-${index}-name`] =
          "This section name duplicates another in this class.";
        errors[`class-${classRow.classId}-section-${firstIndex}-name`] =
          "This section name duplicates another in this class.";
        return;
      }

      seen.set(key, index);
    });
  }

  return errors;
}
