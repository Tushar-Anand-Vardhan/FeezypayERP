import type { SchoolBrandingInput } from "@/lib/config/types";

const PHONE_PATTERN = /^[\d\s+\-()]{10,15}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function trimSchoolBrandingInput(
  input: SchoolBrandingInput,
): SchoolBrandingInput {
  return {
    name: input.name.trim(),
    addressStreet: input.addressStreet.trim(),
    addressCity: input.addressCity.trim(),
    addressState: input.addressState.trim(),
    addressPincode: input.addressPincode.trim(),
    contactPhone: input.contactPhone.trim(),
    contactEmail: input.contactEmail.trim(),
    board: input.board.trim(),
    affiliationNumber: input.affiliationNumber.trim(),
    housesEnabled: input.housesEnabled,
    clubsEnabled: input.clubsEnabled,
    logoPath: input.logoPath,
  };
}

export function validateSchoolBrandingInput(
  input: SchoolBrandingInput,
): Record<string, string> {
  const trimmed = trimSchoolBrandingInput(input);
  const errors: Record<string, string> = {};

  if (!trimmed.name) {
    errors.name = "School name is required.";
  }
  if (!trimmed.board) {
    errors.board = "Board is required.";
  }
  if (trimmed.contactPhone && !PHONE_PATTERN.test(trimmed.contactPhone)) {
    errors.contactPhone = "Enter a valid phone number.";
  }
  if (trimmed.contactEmail && !EMAIL_PATTERN.test(trimmed.contactEmail)) {
    errors.contactEmail = "Enter a valid email.";
  }
  if (trimmed.addressPincode && !/^\d{6}$/.test(trimmed.addressPincode)) {
    errors.addressPincode = "Pincode must be 6 digits.";
  }

  return errors;
}
