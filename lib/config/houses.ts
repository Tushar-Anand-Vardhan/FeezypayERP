import type { HouseInput, ClubInput } from "@/lib/config/types";
import { ensureHouseCode } from "@/lib/config/codes";

export function trimHouseInputs(rows: HouseInput[]): HouseInput[] {
  return rows.map((row, index) => ({
    id: row.id,
    name: row.name.trim(),
    code: row.code?.trim() ?? "",
    displayOrder: row.displayOrder ?? index,
  }));
}

export function trimClubInputs(rows: ClubInput[]): ClubInput[] {
  return rows.map((row, index) => ({
    id: row.id,
    name: row.name.trim(),
    description: row.description?.trim() ?? "",
    displayOrder: row.displayOrder ?? index,
  }));
}

export function validateHouseInputs(
  rows: HouseInput[],
  options: { requireAtLeastOne?: boolean } = {},
): Record<string, string> {
  const errors: Record<string, string> = {};
  const trimmed = trimHouseInputs(rows);

  if (options.requireAtLeastOne) {
    const named = trimmed.filter((row) => row.name);
    if (named.length === 0) {
      errors.houses = "Add at least one house, or turn Houses off.";
      return errors;
    }
  }

  const seenNames = new Map<string, number>();
  const seenCodes = new Map<string, number>();

  trimmed.forEach((row, index) => {
    if (!row.name) {
      errors[`house-${index}-name`] = "House name is required.";
      return;
    }
    const nameKey = row.name.toLowerCase();
    if (seenNames.has(nameKey)) {
      errors[`house-${index}-name`] = "Duplicate house name.";
      errors[`house-${seenNames.get(nameKey)}-name`] = "Duplicate house name.";
    } else {
      seenNames.set(nameKey, index);
    }

    const code = ensureHouseCode(row.name, row.code);
    const codeKey = code.toLowerCase();
    if (seenCodes.has(codeKey)) {
      errors[`house-${index}-code`] = "Duplicate house code.";
      errors[`house-${seenCodes.get(codeKey)}-code`] = "Duplicate house code.";
    } else {
      seenCodes.set(codeKey, index);
    }
  });

  return errors;
}

export function validateClubInputs(
  rows: ClubInput[],
  options: { requireAtLeastOne?: boolean } = {},
): Record<string, string> {
  const errors: Record<string, string> = {};
  const trimmed = trimClubInputs(rows);

  if (options.requireAtLeastOne) {
    const named = trimmed.filter((row) => row.name);
    if (named.length === 0) {
      errors.clubs = "Add at least one club, or turn Clubs off.";
      return errors;
    }
  }

  const seen = new Map<string, number>();
  trimmed.forEach((row, index) => {
    if (!row.name) {
      errors[`club-${index}-name`] = "Club name is required.";
      return;
    }
    const key = row.name.toLowerCase();
    if (seen.has(key)) {
      errors[`club-${index}-name`] = "Duplicate club name.";
      errors[`club-${seen.get(key)}-name`] = "Duplicate club name.";
    } else {
      seen.set(key, index);
    }
  });

  return errors;
}
