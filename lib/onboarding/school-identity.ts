export const BOARD_PRESETS = ["CBSE", "ICSE", "State", "IB"] as const;

export const BOARD_OPTIONS = [...BOARD_PRESETS, "Other"] as const;

export type BoardOption = (typeof BOARD_OPTIONS)[number];
export type BoardPreset = (typeof BOARD_PRESETS)[number];

export const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
] as const;

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const LOGO_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const PHONE_PATTERN = /^[\d\s+\-()]{10,15}$/;

export type SchoolIdentityFormValues = {
  name: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressPincode: string;
  contactPhone: string;
  contactEmail: string;
  board: BoardOption | "";
  boardOther: string;
  affiliationNumber: string;
  academicYearStartMonth: string;
};

export type SchoolIdentityFieldErrors = Partial<
  Record<keyof SchoolIdentityFormValues | "logo", string>
>;

export function isBoardPreset(value: string): value is BoardPreset {
  return (BOARD_PRESETS as readonly string[]).includes(value);
}

export function boardSelectionFromStored(board: string | null): {
  board: BoardOption | "";
  boardOther: string;
} {
  if (!board) {
    return { board: "", boardOther: "" };
  }

  if (isBoardPreset(board)) {
    return { board, boardOther: "" };
  }

  return { board: "Other", boardOther: board };
}

export function resolveBoardForSave(
  board: BoardOption | "",
  boardOther: string,
): string | null {
  if (!board) {
    return null;
  }

  if (board === "Other") {
    const custom = boardOther.trim();
    return custom || null;
  }

  return board;
}

export function trimSchoolIdentityValues(
  values: SchoolIdentityFormValues,
): SchoolIdentityFormValues {
  return {
    name: values.name.trim(),
    addressStreet: values.addressStreet.trim(),
    addressCity: values.addressCity.trim(),
    addressState: values.addressState.trim(),
    addressPincode: values.addressPincode.trim(),
    contactPhone: values.contactPhone.trim(),
    contactEmail: values.contactEmail.trim(),
    board: values.board,
    boardOther: values.boardOther.trim(),
    affiliationNumber: values.affiliationNumber.trim(),
    academicYearStartMonth: values.academicYearStartMonth.trim(),
  };
}

export function validatePhone(phone: string) {
  if (!phone) {
    return "Contact phone is required.";
  }
  if (!PHONE_PATTERN.test(phone)) {
    return "Enter a valid phone number (10–15 digits, spaces, +, -, or parentheses allowed).";
  }
  return null;
}

export function validateLogoFile(file: File | null) {
  if (!file) {
    return null;
  }

  if (
    !LOGO_ALLOWED_MIME_TYPES.includes(
      file.type as (typeof LOGO_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return "Logo must be a JPEG, PNG, WebP, or GIF image.";
  }

  if (file.size > LOGO_MAX_BYTES) {
    return "Logo must be 2 MB or smaller.";
  }

  return null;
}

export function validateSchoolIdentityForm(
  values: SchoolIdentityFormValues,
  validateEmail: (email: string) => string | null,
  logoFile: File | null,
): SchoolIdentityFieldErrors {
  const trimmed = trimSchoolIdentityValues(values);
  const errors: SchoolIdentityFieldErrors = {};

  if (!trimmed.name) {
    errors.name = "School name is required.";
  }
  if (!trimmed.addressStreet) {
    errors.addressStreet = "Street address is required.";
  }
  if (!trimmed.addressCity) {
    errors.addressCity = "City is required.";
  }
  if (!trimmed.addressState) {
    errors.addressState = "State is required.";
  }
  if (!trimmed.addressPincode) {
    errors.addressPincode = "Pincode is required.";
  }

  const phoneError = validatePhone(trimmed.contactPhone);
  if (phoneError) {
    errors.contactPhone = phoneError;
  }

  const emailError = validateEmail(trimmed.contactEmail);
  if (emailError) {
    errors.contactEmail = emailError;
  }

  if (!trimmed.board) {
    errors.board = "Board is required.";
  } else if (trimmed.board === "Other" && !trimmed.boardOther) {
    errors.boardOther = "Enter your board name.";
  }

  if (!trimmed.academicYearStartMonth) {
    errors.academicYearStartMonth = "Academic year start month is required.";
  }

  const logoError = validateLogoFile(logoFile);
  if (logoError) {
    errors.logo = logoError;
  }

  return errors;
}
