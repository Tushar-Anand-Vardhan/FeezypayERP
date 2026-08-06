export type SectionFormRow = {
  name: string;
  capacity: string;
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
    capacity: row.capacity.trim(),
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
      sections: names.map((name) => ({ name, capacity: "" })),
    };
  });
}

function parsePositiveInt(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NaN;
  }

  return parsed;
}

export function validateSectionsByClass(
  classes: ClassSectionsFormRow[],
  options: { requireEveryClassHasSection?: boolean } = {},
): SectionFieldErrors {
  const errors: SectionFieldErrors = {};

  for (const classRow of classes) {
    const trimmedSections = trimSectionRows(classRow.sections);
    const classCapacity = parsePositiveInt(classRow.capacity);

    if (Number.isNaN(classCapacity as number)) {
      errors[`class-${classRow.classId}-capacity`] =
        "Capacity must be a positive integer.";
    }

    if (options.requireEveryClassHasSection && trimmedSections.length === 0) {
      errors[`class-${classRow.classId}-form`] =
        "Add at least one section for this class.";
    }

    const seen = new Map<string, number>();
    let sectionCapacitySum = 0;
    let everySectionHasCapacity = true;

    trimmedSections.forEach((section, index) => {
      if (!section.name) {
        errors[`class-${classRow.classId}-section-${index}-name`] =
          "Section name cannot be empty.";
      }

      const key = section.name.toLowerCase();
      if (section.name) {
        const firstIndex = seen.get(key);
        if (firstIndex !== undefined) {
          errors[`class-${classRow.classId}-section-${index}-name`] =
            "This section name duplicates another in this class.";
          errors[`class-${classRow.classId}-section-${firstIndex}-name`] =
            "This section name duplicates another in this class.";
        } else {
          seen.set(key, index);
        }
      }

      const sectionCapacity = parsePositiveInt(section.capacity);
      if (section.capacity && Number.isNaN(sectionCapacity as number)) {
        errors[`class-${classRow.classId}-section-${index}-capacity`] =
          "Capacity must be a positive integer.";
      } else if (sectionCapacity === null) {
        everySectionHasCapacity = false;
      } else if (typeof sectionCapacity === "number") {
        sectionCapacitySum += sectionCapacity;
      }
    });

    if (typeof classCapacity === "number") {
      if (!everySectionHasCapacity || trimmedSections.length === 0) {
        errors[`class-${classRow.classId}-form`] =
          "When class capacity is set, every section needs a capacity.";
      } else if (sectionCapacitySum !== classCapacity) {
        errors[`class-${classRow.classId}-form`] =
          `Section capacities must add up to the class capacity (${classCapacity}). Currently ${sectionCapacitySum}.`;
      }
    }
  }

  return errors;
}
