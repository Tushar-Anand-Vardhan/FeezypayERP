/**
 * Attendance Engine smoke tests (no DB).
 * Run: npx tsx scripts/smoke-attendance-validation.ts
 */
import assert from "node:assert/strict";
import {
  ATTENDANCE_MARK_STATUSES,
  TEACHER_EDITABLE_WORKFLOWS,
} from "../lib/attendance/types";
import {
  eachDateInclusive,
  teacherMayEditWorkflow,
  validateBulkDailyMarkInput,
  validateDailyMarkInput,
  validateLeaveRequestInput,
  validatePeriodMarkInput,
  visibilityForWorkflow,
} from "../lib/attendance/validation";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("mark statuses");
assert.ok(ATTENDANCE_MARK_STATUSES.includes("late"));
assert.ok(ATTENDANCE_MARK_STATUSES.includes("half_day"));
assert.ok(ATTENDANCE_MARK_STATUSES.includes("leave"));
console.log("OK");

section("daily validation");
const bad = validateDailyMarkInput({
  studentProfileId: "",
  sectionId: "",
  academicYearId: "",
  attendanceDate: "nope",
  status: "present",
});
assert.ok(bad.studentProfileId);
assert.ok(bad.attendanceDate);
const leaveNeed = validateDailyMarkInput({
  studentProfileId: "s",
  sectionId: "sec",
  academicYearId: "y",
  attendanceDate: "2026-08-07",
  status: "leave",
});
assert.ok(leaveNeed.leaveType);
console.log("OK");

section("bulk validation");
const bulk = validateBulkDailyMarkInput({
  sectionId: "sec",
  academicYearId: "y",
  attendanceDate: "2026-08-07",
  marks: [],
});
assert.ok(bulk.marks);
console.log("OK");

section("period FUTURE gate");
const period = validatePeriodMarkInput({
  studentProfileId: "s",
  sectionId: "sec",
  academicYearId: "y",
  attendanceDate: "2026-08-07",
  status: "present",
  periodDefinitionId: "p1",
});
assert.ok(period.enablePeriodAttendance);
console.log("OK");

section("leave + date range");
assert.deepEqual(eachDateInclusive("2026-08-07", "2026-08-09"), [
  "2026-08-07",
  "2026-08-08",
  "2026-08-09",
]);
const leaveOk = validateLeaveRequestInput({
  studentProfileId: "s",
  academicYearId: "y",
  leaveType: "sick",
  startDate: "2026-08-07",
  endDate: "2026-08-08",
});
assert.equal(Object.keys(leaveOk).length, 0);
console.log("OK");

section("teacher edit / visibility");
assert.ok(TEACHER_EDITABLE_WORKFLOWS.includes("draft"));
assert.equal(teacherMayEditWorkflow("draft", null), true);
assert.equal(teacherMayEditWorkflow("submitted", null), true);
assert.equal(teacherMayEditWorkflow("approved", null), false);
assert.equal(teacherMayEditWorkflow("draft", "2026-08-07T00:00:00Z"), false);
assert.deepEqual(visibilityForWorkflow("approved"), {
  visible_to_guardians: true,
  visible_to_students: true,
});
assert.deepEqual(visibilityForWorkflow("draft"), {
  visible_to_guardians: false,
  visible_to_students: false,
});
console.log("OK");

console.log("\nAll attendance smoke checks passed.");
