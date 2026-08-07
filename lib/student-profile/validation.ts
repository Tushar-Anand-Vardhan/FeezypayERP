import type { PersonalInformationInput } from "@/lib/student-profile/types";

export function trimPersonalInput(
  input: PersonalInformationInput,
): PersonalInformationInput {
  return {
    studentProfileId: input.studentProfileId.trim(),
    fullName: input.fullName.trim(),
    firstName: input.firstName?.trim() || undefined,
    lastName: input.lastName?.trim() || undefined,
    dateOfBirth: input.dateOfBirth?.trim() || undefined,
    gender: input.gender || undefined,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    address: input.address?.trim() || undefined,
    photoPath: input.photoPath,
    bloodGroup: input.bloodGroup?.trim() || undefined,
    medicalNotes: input.medicalNotes?.trim() || undefined,
  };
}

export function validatePersonalInput(
  input: PersonalInformationInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const trimmed = trimPersonalInput(input);

  if (!trimmed.studentProfileId) {
    errors.studentProfileId = "Student profile is required.";
  }
  if (!trimmed.fullName) {
    errors.fullName = "Full name is required.";
  }
  if (
    trimmed.gender &&
    trimmed.gender !== "male" &&
    trimmed.gender !== "female" &&
    trimmed.gender !== "other"
  ) {
    errors.gender = "Gender must be male, female, or other.";
  }
  if (trimmed.email && !trimmed.email.includes("@")) {
    errors.email = "Email looks invalid.";
  }
  if (trimmed.dateOfBirth && Number.isNaN(Date.parse(trimmed.dateOfBirth))) {
    errors.dateOfBirth = "Date of birth is invalid.";
  }

  return errors;
}
