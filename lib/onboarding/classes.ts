export type ClassFieldErrors = Record<string, string>;

export type ClassFormRow = {
  id?: string;
  name: string;
};

export const CLASS_PRESET_1_10 = Array.from(
  { length: 10 },
  (_, index) => `Class ${index + 1}`,
);

export const CLASS_PRESET_1_12 = Array.from(
  { length: 12 },
  (_, index) => `Class ${index + 1}`,
);

export const CLASS_PRESET_NURSERY_12 = [
  "Nursery",
  "LKG",
  "UKG",
  ...Array.from({ length: 12 }, (_, index) => `Class ${index + 1}`),
];

export function trimClassNames(names: string[]): string[] {
  return names.map((name) => name.trim());
}

export function appendUniqueClassRows(
  existing: ClassFormRow[],
  toAdd: string[],
): ClassFormRow[] {
  const existingLower = new Set(
    existing.map((row) => row.name.trim().toLowerCase()).filter(Boolean),
  );
  const next = [...existing];

  for (const name of toAdd) {
    const trimmed = name.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (existingLower.has(key)) {
      continue;
    }

    existingLower.add(key);
    next.push({ name: trimmed });
  }

  return next;
}

export function appendUniqueClassNames(
  existing: string[],
  toAdd: string[],
): string[] {
  const existingLower = new Set(
    existing.map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  const next = [...existing];

  for (const name of toAdd) {
    const trimmed = name.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (existingLower.has(key)) {
      continue;
    }

    existingLower.add(key);
    next.push(trimmed);
  }

  return next;
}

export function validateClassRows(
  rows: ClassFormRow[],
  options: { requireAtLeastOne?: boolean } = {},
): ClassFieldErrors {
  return validateClasses(
    rows.map((row) => row.name),
    options,
  );
}

export function validateClasses(
  names: string[],
  options: { requireAtLeastOne?: boolean } = {},
): ClassFieldErrors {
  const errors: ClassFieldErrors = {};
  const trimmed = trimClassNames(names);

  if (options.requireAtLeastOne && trimmed.length === 0) {
    errors.form = "Add at least one class.";
    return errors;
  }

  const seen = new Map<string, number>();

  trimmed.forEach((name, index) => {
    if (!name) {
      errors[`class-${index}`] = "Class name cannot be empty.";
      return;
    }

    const key = name.toLowerCase();
    const firstIndex = seen.get(key);

    if (firstIndex !== undefined) {
      errors[`class-${index}`] = "This class name duplicates another.";
      errors[`class-${firstIndex}`] = "This class name duplicates another.";
      return;
    }

    seen.set(key, index);
  });

  return errors;
}
