import {
  MEMBERSHIP_ROLES,
  type ClubCatalogInput,
  type ClubMembershipInput,
  type HouseCatalogInput,
  type HouseMembershipInput,
} from "@/lib/houses-clubs/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOUR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) {
    return false;
  }
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

export function isColour(value: string): boolean {
  return COLOUR_RE.test(value.trim());
}

export function trimHouseCatalogInput(
  input: HouseCatalogInput,
): HouseCatalogInput {
  return {
    id: input.id,
    name: input.name.trim(),
    code: input.code?.trim() ?? "",
    description: input.description?.trim() ?? "",
    colour: input.colour?.trim() ?? "",
    secondaryColour: input.secondaryColour?.trim() ?? "",
    logoPath: input.logoPath?.trim() || null,
    academicYearId: input.academicYearId?.trim() || null,
    teacherInChargeEmploymentId:
      input.teacherInChargeEmploymentId?.trim() || null,
    displayOrder: input.displayOrder ?? 0,
    pointsTrackingEnabled: input.pointsTrackingEnabled ?? false,
  };
}

export function validateHouseCatalogInput(
  input: HouseCatalogInput,
): Record<string, string> {
  const trimmed = trimHouseCatalogInput(input);
  const errors: Record<string, string> = {};
  if (!trimmed.name) {
    errors.name = "House name is required.";
  }
  if (trimmed.colour && !isColour(trimmed.colour)) {
    errors.colour = "Colour must be a hex value like #RRGGBB.";
  }
  if (trimmed.secondaryColour && !isColour(trimmed.secondaryColour)) {
    errors.secondaryColour = "Secondary colour must be hex like #RRGGBB.";
  }
  return errors;
}

export function trimClubCatalogInput(
  input: ClubCatalogInput,
): ClubCatalogInput {
  return {
    id: input.id,
    name: input.name.trim(),
    code: input.code?.trim() ?? "",
    description: input.description?.trim() ?? "",
    colour: input.colour?.trim() ?? "",
    logoPath: input.logoPath?.trim() || null,
    academicYearId: input.academicYearId?.trim() || null,
    teacherInChargeEmploymentId:
      input.teacherInChargeEmploymentId?.trim() || null,
    displayOrder: input.displayOrder ?? 0,
    eventsEnabled: input.eventsEnabled ?? false,
  };
}

export function validateClubCatalogInput(
  input: ClubCatalogInput,
): Record<string, string> {
  const trimmed = trimClubCatalogInput(input);
  const errors: Record<string, string> = {};
  if (!trimmed.name) {
    errors.name = "Club name is required.";
  }
  if (trimmed.colour && !isColour(trimmed.colour)) {
    errors.colour = "Colour must be a hex value like #RRGGBB.";
  }
  return errors;
}

export function validateHouseMembershipInput(
  input: HouseMembershipInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.houseId?.trim()) {
    errors.houseId = "House is required.";
  }
  if (!input.studentProfileId?.trim()) {
    errors.studentProfileId = "Student is required.";
  }
  const role = input.role ?? "member";
  if (!MEMBERSHIP_ROLES.includes(role)) {
    errors.role = "Invalid membership role.";
  }
  if (input.joinedOn && !isIsoDate(input.joinedOn.trim())) {
    errors.joinedOn = "Joined on must be YYYY-MM-DD.";
  }
  return errors;
}

export function validateClubMembershipInput(
  input: ClubMembershipInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.clubId?.trim()) {
    errors.clubId = "Club is required.";
  }
  if (!input.studentProfileId?.trim()) {
    errors.studentProfileId = "Student is required.";
  }
  const role = input.role ?? "member";
  if (!MEMBERSHIP_ROLES.includes(role)) {
    errors.role = "Invalid membership role.";
  }
  if (input.joinedOn && !isIsoDate(input.joinedOn.trim())) {
    errors.joinedOn = "Joined on must be YYYY-MM-DD.";
  }
  return errors;
}
