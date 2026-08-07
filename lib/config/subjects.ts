import { ensureSubjectCode } from "@/lib/config/codes";
import type { SubjectInput, SubjectType } from "@/lib/config/types";

export const SUBJECT_TYPES: SubjectType[] = ["scholastic", "co_scholastic"];

export function trimSubjectInputs(rows: SubjectInput[]): SubjectInput[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name.trim(),
    code: row.code?.trim() ?? "",
    type: row.type,
  }));
}

export function validateSubjectInputs(
  rows: SubjectInput[],
  options: { requireAtLeastOne?: boolean } = {},
): Record<string, string> {
  const errors: Record<string, string> = {};
  const trimmed = trimSubjectInputs(rows);

  if (options.requireAtLeastOne && trimmed.length === 0) {
    errors.form = "Add at least one subject.";
    return errors;
  }

  const seenNames = new Map<string, number>();
  const seenCodes = new Map<string, number>();

  trimmed.forEach((row, index) => {
    if (!row.name) {
      errors[`subject-${index}-name`] = "Subject name is required.";
      return;
    }

    if (!SUBJECT_TYPES.includes(row.type)) {
      errors[`subject-${index}-type`] = "Select a valid subject type.";
      return;
    }

    const nameKey = row.name.toLowerCase();
    const nameFirst = seenNames.get(nameKey);
    if (nameFirst !== undefined) {
      errors[`subject-${index}-name`] = "This subject name duplicates another.";
      errors[`subject-${nameFirst}-name`] = "This subject name duplicates another.";
    } else {
      seenNames.set(nameKey, index);
    }

    const code = ensureSubjectCode(row.name, row.code);
    const codeKey = code.toLowerCase();
    const codeFirst = seenCodes.get(codeKey);
    if (codeFirst !== undefined) {
      errors[`subject-${index}-code`] = "This subject code duplicates another.";
      errors[`subject-${codeFirst}-code`] = "This subject code duplicates another.";
    } else {
      seenCodes.set(codeKey, index);
    }
  });

  return errors;
}
