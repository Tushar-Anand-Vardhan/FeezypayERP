/**
 * Principal Dashboard catalogue smoke (no DB).
 * Run: npx tsx scripts/smoke-principal-dashboard-validation.ts
 */

import assert from "node:assert/strict";
import {
  PRINCIPAL_DASHBOARD_PANELS,
  dayOfWeekFromDate,
  parseAsOfDate,
  toIsoDate,
} from "../lib/principal-dashboard/catalog";
import type { PrincipalPanelId } from "../lib/principal-dashboard/types";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("panel catalogue");
const ids = PRINCIPAL_DASHBOARD_PANELS.map((p) => p.id);
const required: PrincipalPanelId[] = [
  "school_attendance",
  "teacher_attendance",
  "student_performance",
  "department_performance",
  "upcoming_events",
  "pending_approvals",
  "pending_report_cards",
  "pending_assessments",
  "notifications",
  "school_health",
];
for (const id of required) {
  assert.ok(ids.includes(id), `missing ${id}`);
}
assert.equal(new Set(ids).size, ids.length);
assert.ok(
  PRINCIPAL_DASHBOARD_PANELS.every((p) => p.sourceTables.length > 0),
  "all panels data-driven",
);
assert.ok(
  PRINCIPAL_DASHBOARD_PANELS.every((p) => p.workflowIds.length > 0),
  "workflow citations",
);
console.log("OK", ids.length, "panels");

section("teacher attendance note");
{
  const panel = PRINCIPAL_DASHBOARD_PANELS.find(
    (p) => p.id === "teacher_attendance",
  );
  assert.ok(panel?.description.includes("FUTURE"), "documents FUTURE staff att");
}
console.log("OK");

section("date helpers");
{
  const d = parseAsOfDate("2026-08-07");
  assert.equal(toIsoDate(d), "2026-08-07");
  assert.ok(dayOfWeekFromDate(d) >= 1 && dayOfWeekFromDate(d) <= 7);
  const now = parseAsOfDate(null);
  assert.ok(toIsoDate(now).length === 10);
}
console.log("OK");

console.log("\nAll principal dashboard validation checks passed.");
