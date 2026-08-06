export type StaffFormRow = {
  fullName: string;
  phone: string;
  email: string;
  aadhaar: string;
  employeeCode: string;
  designation: string;
  departmentName: string;
  subjectNames: string[];
  isHod: boolean;
};

export type StaffFieldErrors = Record<string, string>;

export const STAFF_CSV_HEADERS = [
  "full_name",
  "phone",
  "email",
  "aadhaar",
  "employee_code",
  "designation",
  "department",
  "subjects",
  "is_hod",
] as const;

export function trimStaffRows(rows: StaffFormRow[]): StaffFormRow[] {
  return rows.map((row) => ({
    fullName: row.fullName.trim(),
    phone: row.phone.trim(),
    email: row.email.trim(),
    aadhaar: row.aadhaar.trim(),
    employeeCode: row.employeeCode.trim(),
    designation: row.designation.trim(),
    departmentName: row.departmentName.trim(),
    subjectNames: row.subjectNames.map((name) => name.trim()).filter(Boolean),
    isHod: row.isHod,
  }));
}

export function staffRowFromCsv(row: Record<string, string>): StaffFormRow {
  return {
    fullName: row.full_name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    aadhaar: row.aadhaar ?? "",
    employeeCode: row.employee_code ?? "",
    designation: row.designation ?? "",
    departmentName: row.department ?? "",
    subjectNames: (row.subjects ?? "")
      .split("|")
      .map((value) => value.trim())
      .filter(Boolean),
    isHod: ["true", "1", "yes", "y"].includes(
      (row.is_hod ?? "").trim().toLowerCase(),
    ),
  };
}

export function validateStaffRows(
  rows: StaffFormRow[],
  availableSubjects: string[],
  options: { requireAtLeastOne?: boolean } = {},
): StaffFieldErrors {
  const errors: StaffFieldErrors = {};
  const trimmed = trimStaffRows(rows);
  const subjectSet = new Set(
    availableSubjects.map((name) => name.trim().toLowerCase()),
  );

  if (options.requireAtLeastOne && trimmed.length === 0) {
    errors.form = "Add at least one teacher before continuing.";
    return errors;
  }

  const emailSeen = new Map<string, number>();
  const aadhaarSeen = new Map<string, number>();
  const codeSeen = new Map<string, number>();

  trimmed.forEach((row, index) => {
    if (!row.fullName) {
      errors[`staff-${index}-fullName`] = "Name is required.";
    }
    if (row.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors[`staff-${index}-email`] = "Enter a valid email.";
      } else {
        const key = row.email.toLowerCase();
        if (emailSeen.has(key)) {
          errors[`staff-${index}-email`] = "Duplicate email in this list.";
        } else {
          emailSeen.set(key, index);
        }
      }
    }
    if (row.aadhaar) {
      const digits = row.aadhaar.replace(/\D/g, "");
      if (digits.length !== 12) {
        errors[`staff-${index}-aadhaar`] = "Aadhaar must be exactly 12 digits.";
      } else if (aadhaarSeen.has(digits)) {
        errors[`staff-${index}-aadhaar`] = "Duplicate Aadhaar in this list.";
      } else {
        aadhaarSeen.set(digits, index);
      }
    }
    if (row.employeeCode) {
      const key = row.employeeCode.toLowerCase();
      if (codeSeen.has(key)) {
        errors[`staff-${index}-employeeCode`] = "Duplicate employee code.";
      } else {
        codeSeen.set(key, index);
      }
    }
    for (const subject of row.subjectNames) {
      if (!subjectSet.has(subject.toLowerCase())) {
        errors[`staff-${index}-subjects`] =
          `"${subject}" is not in your subject catalog.`;
        break;
      }
    }
    if (row.isHod && !row.departmentName) {
      errors[`staff-${index}-departmentName`] =
        "Select which department this HOD leads.";
    }
  });

  return errors;
}

export function validateStaffDraft(
  draft: StaffFormRow,
  availableSubjects: string[],
  existing: StaffFormRow[],
): StaffFieldErrors {
  const errors = validateStaffRows([draft, ...existing], availableSubjects);
  const remapped: StaffFieldErrors = {};
  for (const [key, value] of Object.entries(errors)) {
    if (key.startsWith("staff-0-")) {
      remapped[`draft-${key.slice("staff-0-".length)}`] = value;
    }
  }
  if (!draft.fullName.trim()) {
    remapped.draftName = "Name is required.";
  }
  if (draft.isHod && !draft.departmentName.trim()) {
    remapped.draftDepartmentName = "Select which department this HOD leads.";
  }
  return remapped;
}
