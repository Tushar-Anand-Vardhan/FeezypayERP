/**
 * Teacher Workspace smoke tests (no DB).
 * Run: npx tsx scripts/smoke-teacher-workspace-validation.ts
 */
import assert from "node:assert/strict";
import {
  TEACHER_AI_SHORTCUT_PLACEHOLDERS,
  TEACHER_WORKSPACE_PANELS,
  dayOfWeekFromDate,
  parseAsOfDate,
  toIsoDate,
} from "../lib/teacher-workspace/catalog";
import type { TeacherWorkspacePanelId } from "../lib/teacher-workspace/types";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("panel catalogue");
const ids = TEACHER_WORKSPACE_PANELS.map((p) => p.id);
const required: TeacherWorkspacePanelId[] = [
  "todays_timetable",
  "pending_attendance",
  "pending_assessments",
  "homework",
  "announcements",
  "upcoming_events",
  "class_reminders",
  "department_notices",
  "ai_shortcuts",
];
for (const id of required) {
  assert.ok(ids.includes(id), `missing ${id}`);
}
assert.equal(new Set(ids).size, ids.length);
assert.ok(
  TEACHER_WORKSPACE_PANELS.every(
    (p) => p.id === "ai_shortcuts" || p.sourceTables.length > 0,
  ),
);
console.log("OK", ids.length, "panels");

section("date helpers");
const d = parseAsOfDate("2026-08-07");
assert.equal(toIsoDate(d), "2026-08-07");
assert.equal(dayOfWeekFromDate(d), 5); // Friday
assert.equal(dayOfWeekFromDate(parseAsOfDate("2026-08-09")), 7); // Sunday
console.log("OK");

section("AI placeholders");
assert.ok(TEACHER_AI_SHORTCUT_PLACEHOLDERS.length >= 3);
assert.ok(
  TEACHER_AI_SHORTCUT_PLACEHOLDERS.every(
    (s) => s.status === "placeholder" && s.serviceId.startsWith("ai."),
  ),
);
assert.ok(
  !TEACHER_AI_SHORTCUT_PLACEHOLDERS.some((s) =>
    /academy|school name|feezy academy/i.test(s.label),
  ),
);
console.log("OK");

console.log("\nAll teacher workspace smoke checks passed.");
