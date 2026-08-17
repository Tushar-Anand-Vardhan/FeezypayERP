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
  aadhaar: string;
  email: string;
  className: string;
  sectionName: string;
  guardians: GuardianFormRow[];
};

export type StudentFieldErrors = Record<string, string>;

export type ClassSectionPair = {
  className: string;
  sectionName: string;
};

export const STUDENT_CSV_HEADERS = [
  "full_name",
  "date_of_birth",
  "gender",
  "admission_number",
  "aadhaar",
  "email",
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
    aadhaar: "",
    email: "",
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
    aadhaar: row.aadhaar ?? "",
    email: row.email ?? "",
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
    aadhaar: row.aadhaar.trim(),
    email: row.email.trim(),
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

/** Strip common labels so CSV "6" matches catalog "Class 6". */
export function normalizeClassToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^(class|grade|std\.?|standard|cls)\s+/i, "")
    .replace(/\s+/g, " ");
}

export function normalizeSectionToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatAvailablePairs(pairs: ClassSectionPair[]): string {
  if (pairs.length === 0) {
    return "none configured yet";
  }
  const labels = pairs.map(
    (pair) => `${pair.className} / ${pair.sectionName}`,
  );
  if (labels.length <= 8) {
    return labels.join("; ");
  }
  return `${labels.slice(0, 8).join("; ")}; … (+${labels.length - 8} more)`;
}

/**
 * Resolve CSV/form class+section against catalog pairs.
 * Accepts exact case-insensitive match, or class aliases like "6" ↔ "Class 6".
 */
export function resolveClassSectionPair(
  className: string,
  sectionName: string,
  pairs: ClassSectionPair[],
): ClassSectionPair | null {
  const classExact = className.trim().toLowerCase();
  const sectionExact = normalizeSectionToken(sectionName);
  const classToken = normalizeClassToken(className);

  if (!classExact || !sectionExact) {
    return null;
  }

  const exact = pairs.find(
    (pair) =>
      pair.className.trim().toLowerCase() === classExact &&
      normalizeSectionToken(pair.sectionName) === sectionExact,
  );
  if (exact) {
    return exact;
  }

  const aliases = pairs.filter(
    (pair) =>
      normalizeClassToken(pair.className) === classToken &&
      normalizeSectionToken(pair.sectionName) === sectionExact,
  );
  if (aliases.length === 1) {
    return aliases[0] ?? null;
  }

  // Ambiguous alias (two classes normalize to the same token) — force exact name.
  return null;
}

export function describeClassSectionMismatch(
  className: string,
  sectionName: string,
  pairs: ClassSectionPair[],
): string {
  const providedClass = className.trim() || "(blank)";
  const providedSection = sectionName.trim() || "(blank)";
  const available = formatAvailablePairs(pairs);

  if (!className.trim() || !sectionName.trim()) {
    return `Class and section are required (got "${providedClass}" / "${providedSection}"). Available: ${available}.`;
  }

  const classToken = normalizeClassToken(className);
  const sectionToken = normalizeSectionToken(sectionName);
  const classMatches = pairs.filter(
    (pair) =>
      pair.className.trim().toLowerCase() === className.trim().toLowerCase() ||
      normalizeClassToken(pair.className) === classToken,
  );
  const sectionMatches = pairs.filter(
    (pair) => normalizeSectionToken(pair.sectionName) === sectionToken,
  );

  if (classMatches.length === 0 && sectionMatches.length === 0) {
    return `Class/section "${providedClass}" / "${providedSection}" was not found. Neither the class nor the section matched your setup. Available: ${available}. Tip: CSV class can be "6" or the full name like "Class 6"; section must match (Rose / Lotus is fine in any case).`;
  }

  if (classMatches.length === 0) {
    return `Class "${providedClass}" was not found (section "${providedSection}" looks familiar). Available classes: ${[
      ...new Set(pairs.map((pair) => pair.className)),
    ].join(", ") || "none"}. Tip: use the exact class name from Classes setup, or a short form like "6" for "Class 6".`;
  }

  if (sectionMatches.length === 0) {
    const sectionsForClass = classMatches.map((pair) => pair.sectionName);
    return `Section "${providedSection}" was not found under class "${providedClass}". Sections for that class: ${sectionsForClass.join(", ") || "none"}. Available overall: ${available}.`;
  }

  const aliasHits = pairs.filter(
    (pair) =>
      normalizeClassToken(pair.className) === classToken &&
      normalizeSectionToken(pair.sectionName) === sectionToken,
  );
  if (aliasHits.length > 1) {
    return `Class/section "${providedClass}" / "${providedSection}" is ambiguous (matches ${aliasHits
      .map((pair) => `${pair.className} / ${pair.sectionName}`)
      .join("; ")}). Use the exact class name from setup.`;
  }

  return `Class/section "${providedClass}" / "${providedSection}" was not found as a pair. Available: ${available}.`;
}

export function validateStudentRows(
  rows: StudentFormRow[],
  classSectionPairs: ClassSectionPair[],
  options: { requireAtLeastOne?: boolean } = {},
): StudentFieldErrors {
  const errors: StudentFieldErrors = {};
  const trimmed = trimStudentRows(rows);

  if (options.requireAtLeastOne && trimmed.length === 0) {
    errors.form = "Add at least one student before continuing.";
    return errors;
  }

  const admissionSeen = new Map<string, number>();
  const aadhaarSeen = new Map<string, number>();

  trimmed.forEach((row, index) => {
    if (!row.fullName) {
      errors[`student-${index}-fullName`] = "Student name is required.";
    }
    if (!row.admissionNumber) {
      errors[`student-${index}-admissionNumber`] =
        "Admission number is required.";
    } else {
      const key = row.admissionNumber.toLowerCase();
      if (admissionSeen.has(key)) {
        const first = admissionSeen.get(key)!;
        errors[`student-${index}-admissionNumber`] =
          `Duplicate admission number "${row.admissionNumber}" (also on student ${first + 1}).`;
      } else {
        admissionSeen.set(key, index);
      }
    }
    if (row.aadhaar) {
      const digits = row.aadhaar.replace(/\D/g, "");
      if (digits.length !== 12) {
        errors[`student-${index}-aadhaar`] =
          `Aadhaar must be exactly 12 digits (got ${digits.length || 0}).`;
      } else if (aadhaarSeen.has(digits)) {
        const first = aadhaarSeen.get(digits)!;
        errors[`student-${index}-aadhaar`] =
          `Duplicate Aadhaar (also on student ${first + 1}).`;
      } else {
        aadhaarSeen.set(digits, index);
      }
    }
    if (row.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors[`student-${index}-email`] =
          `Enter a valid email (got "${row.email}").`;
      }
    }
    if (row.gender === "" && row.dateOfBirth) {
      // gender optional in form; leave quiet
    }
    if (row.gender && !["male", "female", "other"].includes(row.gender)) {
      errors[`student-${index}-gender`] =
        `Gender must be male, female, or other (got "${row.gender}").`;
    }

    if (!resolveClassSectionPair(row.className, row.sectionName, classSectionPairs)) {
      errors[`student-${index}-section`] = describeClassSectionMismatch(
        row.className,
        row.sectionName,
        classSectionPairs,
      );
    }

    const primary = row.guardians[0];
    if (!primary?.fullName) {
      errors[`student-${index}-guardian`] =
        "At least one guardian name is required.";
    }
  });

  return errors;
}
