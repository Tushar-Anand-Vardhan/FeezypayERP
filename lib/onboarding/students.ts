export type GuardianFormRow = {
  fullName: string;
  relationship: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  whatsappOptIn: boolean;
};

export type StudentFormRow = {
  fullName: string;
  dateOfBirth: string;
  gender: "" | "male" | "female" | "other";
  admissionNumber: string;
  className: string;
  sectionName: string;
  guardians: GuardianFormRow[];
};

export type StudentFieldErrors = Record<string, string>;

export const STUDENT_CSV_HEADERS = [
  "full_name",
  "date_of_birth",
  "gender",
  "admission_number",
  "class",
  "section",
  "guardian_name",
  "relationship",
  "guardian_phone",
  "guardian_whatsapp",
  "guardian_email",
  "whatsapp_opt_in",
] as const;

export function emptyGuardian(): GuardianFormRow {
  return {
    fullName: "",
    relationship: "parent",
    phone: "",
    whatsappNumber: "",
    email: "",
    whatsappOptIn: false,
  };
}

export function emptyStudent(): StudentFormRow {
  return {
    fullName: "",
    dateOfBirth: "",
    gender: "",
    admissionNumber: "",
    className: "",
    sectionName: "",
    guardians: [emptyGuardian()],
  };
}

export function studentRowFromCsv(row: Record<string, string>): StudentFormRow {
  const genderRaw = (row.gender ?? "").trim().toLowerCase();
  const gender =
    genderRaw === "male" || genderRaw === "female" || genderRaw === "other"
      ? genderRaw
      : "";

  return {
    fullName: row.full_name ?? "",
    dateOfBirth: row.date_of_birth ?? "",
    gender,
    admissionNumber: row.admission_number ?? "",
    className: row.class ?? "",
    sectionName: row.section ?? "",
    guardians: [
      {
        fullName: row.guardian_name ?? "",
        relationship: row.relationship || "parent",
        phone: row.guardian_phone ?? "",
        whatsappNumber: row.guardian_whatsapp ?? "",
        email: row.guardian_email ?? "",
        whatsappOptIn: ["true", "1", "yes", "y"].includes(
          (row.whatsapp_opt_in ?? "").trim().toLowerCase(),
        ),
      },
    ],
  };
}

export function trimStudentRows(rows: StudentFormRow[]): StudentFormRow[] {
  return rows.map((row) => ({
    fullName: row.fullName.trim(),
    dateOfBirth: row.dateOfBirth.trim(),
    gender: row.gender,
    admissionNumber: row.admissionNumber.trim(),
    className: row.className.trim(),
    sectionName: row.sectionName.trim(),
    guardians: row.guardians.map((guardian) => ({
      fullName: guardian.fullName.trim(),
      relationship: guardian.relationship.trim() || "parent",
      phone: guardian.phone.trim(),
      whatsappNumber: guardian.whatsappNumber.trim(),
      email: guardian.email.trim(),
      whatsappOptIn: guardian.whatsappOptIn,
    })),
  }));
}

export function validateStudentRows(
  rows: StudentFormRow[],
  classSectionPairs: Array<{ className: string; sectionName: string }>,
  options: { requireAtLeastOne?: boolean } = {},
): StudentFieldErrors {
  const errors: StudentFieldErrors = {};
  const trimmed = trimStudentRows(rows);

  if (options.requireAtLeastOne && trimmed.length === 0) {
    errors.form = "Add at least one student before continuing.";
    return errors;
  }

  const pairSet = new Set(
    classSectionPairs.map(
      (pair) =>
        `${pair.className.trim().toLowerCase()}::${pair.sectionName.trim().toLowerCase()}`,
    ),
  );
  const admissionSeen = new Map<string, number>();

  trimmed.forEach((row, index) => {
    if (!row.fullName) {
      errors[`student-${index}-fullName`] = "Name is required.";
    }
    if (!row.admissionNumber) {
      errors[`student-${index}-admissionNumber`] = "Admission number is required.";
    } else {
      const key = row.admissionNumber.toLowerCase();
      if (admissionSeen.has(key)) {
        errors[`student-${index}-admissionNumber`] = "Duplicate admission number.";
      } else {
        admissionSeen.set(key, index);
      }
    }
    if (!row.className || !row.sectionName) {
      errors[`student-${index}-section`] = "Class and section are required.";
    } else {
      const key = `${row.className.toLowerCase()}::${row.sectionName.toLowerCase()}`;
      if (!pairSet.has(key)) {
        errors[`student-${index}-section`] =
          "Class/section combination was not found.";
      }
    }

    const primary = row.guardians[0];
    if (!primary?.fullName) {
      errors[`student-${index}-guardian`] = "At least one guardian name is required.";
    }
  });

  return errors;
}
