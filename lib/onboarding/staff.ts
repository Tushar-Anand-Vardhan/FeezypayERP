export type StaffFormRow = {
  fullName: string;
  phone: string;
  email: string;
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
        "HOD teachers need a department.";
    }
  });

  return errors;
}
