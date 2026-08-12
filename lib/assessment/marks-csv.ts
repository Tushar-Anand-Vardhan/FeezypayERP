import { parseCsv } from "@/lib/onboarding/csv";

export type MarksCsvRow = {
  studentProfileId?: string;
  admissionNumber?: string;
  fullName?: string;
  marksObtained: number | null;
  isAbsent: boolean;
  teacherRemark?: string | null;
};

/**
 * Parse a marks CSV.
 * Accepted headers (case-insensitive): student_profile_id | admission_number | name,
 * marks | marks_obtained, absent | is_absent, remark | teacher_remark.
 */
export function parseMarksCsv(text: string): {
  rows: MarksCsvRow[];
  error?: string;
} {
  const parsed = parseCsv(text);
  if (parsed.headers.length === 0) {
    return { rows: [], error: "CSV is empty." };
  }

  const headerMap = new Map(
    parsed.headers.map((h) => [h.trim().toLowerCase(), h]),
  );

  function col(...aliases: string[]): string | null {
    for (const a of aliases) {
      const key = headerMap.get(a);
      if (key) return key;
    }
    return null;
  }

  const idCol = col("student_profile_id", "student_id", "profile_id");
  const admCol = col("admission_number", "admission_no", "adm_no");
  const nameCol = col("name", "full_name", "student_name");
  const marksCol = col("marks", "marks_obtained", "score");
  const absentCol = col("absent", "is_absent");
  const remarkCol = col("remark", "teacher_remark", "remarks");

  if (!idCol && !admCol && !nameCol) {
    return {
      rows: [],
      error:
        "CSV needs student_profile_id, admission_number, or name column.",
    };
  }

  const rows: MarksCsvRow[] = [];
  for (const raw of parsed.rows) {
    const absentRaw = absentCol ? (raw[absentCol] ?? "").toLowerCase() : "";
    const isAbsent = ["1", "true", "yes", "y", "absent"].includes(absentRaw);
    const marksRaw = marksCol ? raw[marksCol] ?? "" : "";
    let marksObtained: number | null = null;
    if (!isAbsent && marksRaw !== "") {
      const n = Number(marksRaw);
      if (!Number.isFinite(n)) {
        return {
          rows: [],
          error: `Invalid marks value "${marksRaw}".`,
        };
      }
      marksObtained = n;
    }
    rows.push({
      studentProfileId: idCol ? raw[idCol] || undefined : undefined,
      admissionNumber: admCol ? raw[admCol] || undefined : undefined,
      fullName: nameCol ? raw[nameCol] || undefined : undefined,
      marksObtained,
      isAbsent,
      teacherRemark: remarkCol ? raw[remarkCol] || null : null,
    });
  }

  return { rows };
}

export function matchMarksCsvToRoster(
  csvRows: MarksCsvRow[],
  roster: Array<{
    studentProfileId: string;
    fullName: string;
    admissionNumber?: string | null;
  }>,
): {
  marks: Array<{
    studentProfileId: string;
    marksObtained: number | null;
    isAbsent: boolean;
    teacherRemark?: string | null;
  }>;
  unmatched: string[];
} {
  const byId = new Map(roster.map((r) => [r.studentProfileId, r]));
  const byAdm = new Map(
    roster
      .filter((r) => r.admissionNumber)
      .map((r) => [r.admissionNumber!.toLowerCase(), r]),
  );
  const byName = new Map(
    roster.map((r) => [r.fullName.trim().toLowerCase(), r]),
  );

  const marks: Array<{
    studentProfileId: string;
    marksObtained: number | null;
    isAbsent: boolean;
    teacherRemark?: string | null;
  }> = [];
  const unmatched: string[] = [];

  for (const row of csvRows) {
    let matched =
      (row.studentProfileId && byId.get(row.studentProfileId)) ||
      (row.admissionNumber &&
        byAdm.get(row.admissionNumber.trim().toLowerCase())) ||
      (row.fullName && byName.get(row.fullName.trim().toLowerCase())) ||
      null;
    if (!matched) {
      unmatched.push(
        row.studentProfileId ||
          row.admissionNumber ||
          row.fullName ||
          "(blank)",
      );
      continue;
    }
    marks.push({
      studentProfileId: matched.studentProfileId,
      marksObtained: row.marksObtained,
      isAbsent: row.isAbsent,
      teacherRemark: row.teacherRemark,
    });
  }

  return { marks, unmatched };
}
