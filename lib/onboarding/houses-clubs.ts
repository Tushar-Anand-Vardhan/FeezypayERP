export type HouseFormRow = { name: string };
export type ClubFormRow = { name: string; description: string };

export type HousesClubsFieldErrors = Record<string, string>;

export function trimHouseRows(rows: HouseFormRow[]): HouseFormRow[] {
  return rows.map((row) => ({ name: row.name.trim() }));
}

export function trimClubRows(rows: ClubFormRow[]): ClubFormRow[] {
  return rows.map((row) => ({
    name: row.name.trim(),
    description: row.description.trim(),
  }));
}

export function validateHousesClubsForm(input: {
  housesEnabled: boolean;
  clubsEnabled: boolean;
  houses: HouseFormRow[];
  clubs: ClubFormRow[];
}): HousesClubsFieldErrors {
  const errors: HousesClubsFieldErrors = {};
  const houses = trimHouseRows(input.houses);
  const clubs = trimClubRows(input.clubs);

  if (input.housesEnabled) {
    const namedHouses = houses.filter((row) => row.name);
    if (namedHouses.length === 0) {
      errors.houses = "Add at least one house, or turn Houses off.";
    }

    const seen = new Map<string, number>();
    houses.forEach((row, index) => {
      if (!row.name) {
        errors[`house-${index}-name`] = "House name is required.";
        return;
      }
      const key = row.name.toLowerCase();
      if (seen.has(key)) {
        errors[`house-${index}-name`] = "Duplicate house name.";
        errors[`house-${seen.get(key)}-name`] = "Duplicate house name.";
      } else {
        seen.set(key, index);
      }
    });
  }

  if (input.clubsEnabled) {
    const namedClubs = clubs.filter((row) => row.name);
    if (namedClubs.length === 0) {
      errors.clubs = "Add at least one club, or turn Clubs off.";
    }

    const seen = new Map<string, number>();
    clubs.forEach((row, index) => {
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
  }

  return errors;
}
