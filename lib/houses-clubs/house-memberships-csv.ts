/** House membership CSV (Wave 4 / D13). */

import { parseCsv } from "@/lib/onboarding/csv";
import type { MembershipRole } from "@/lib/houses-clubs/types";

export const HOUSE_MEMBERSHIP_CSV_HEADERS = [
  "admission_number",
  "house_code",
  "role",
] as const;

export type HouseMembershipCsvRow = {
  admissionNumber: string;
  houseCode: string;
  role: MembershipRole;
  line: number;
};

const ROLES: MembershipRole[] = ["member", "captain", "vice_captain"];

export function parseHouseMembershipCsv(text: string):
  | { ok: true; rows: HouseMembershipCsvRow[] }
  | { ok: false; error: string; fieldErrors?: Record<string, string> } {
  const parsed = parseCsv(text);
  for (const h of HOUSE_MEMBERSHIP_CSV_HEADERS) {
    if (!parsed.headers.includes(h)) {
      return {
        ok: false,
        error: `CSV must include columns: ${HOUSE_MEMBERSHIP_CSV_HEADERS.join(", ")}.`,
      };
    }
  }
  if (parsed.rows.length === 0) {
    return { ok: false, error: "CSV has no data rows." };
  }

  const fieldErrors: Record<string, string> = {};
  const rows: HouseMembershipCsvRow[] = [];

  parsed.rows.forEach((row, index) => {
    const line = index + 2;
    const admissionNumber = (row.admission_number ?? "").trim();
    const houseCode = (row.house_code ?? "").trim();
    const roleRaw = (row.role ?? "member").trim().toLowerCase() || "member";

    if (!admissionNumber) {
      fieldErrors[`row-${line}`] = "admission_number is required.";
      return;
    }
    if (!houseCode) {
      fieldErrors[`row-${line}`] = "house_code is required.";
      return;
    }
    if (!ROLES.includes(roleRaw as MembershipRole)) {
      fieldErrors[`row-${line}`] =
        `role must be one of ${ROLES.join(", ")}.`;
      return;
    }

    rows.push({
      admissionNumber,
      houseCode,
      role: roleRaw as MembershipRole,
      line,
    });
  });

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Fix CSV errors before importing (blocking validation).",
      fieldErrors,
    };
  }

  return { ok: true, rows };
}
