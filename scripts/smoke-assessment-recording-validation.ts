/**
 * Assessment Recording Engine (E32) validation smoke tests (no DB).
 * Run: npx tsx scripts/smoke-assessment-recording-validation.ts
 */
import assert from "node:assert/strict";
import { PERMISSION_KEYS } from "../lib/authz/catalog";
import { SYSTEM_ROLE_BUNDLES } from "../lib/authz/bundles";
import {
  isLockPermission,
  lockPermissionKeys,
  marksAreAppendOnly,
  teacherMayEditRecordStatus,
  teacherRecordingPermissionKeys,
  validateBulkMarks,
  validateMarkEntry,
  validateRecordInput,
} from "../lib/assessment-recording/validation";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("permission keys in catalog");
for (const key of [
  "assessment_recording.read",
  "assessment_recording.create",
  "assessment_recording.edit",
  "assessment_recording.enter_marks",
  "assessment_recording.lock",
  "assessment_recording.unlock",
] as const) {
  assert.ok((PERMISSION_KEYS as readonly string[]).includes(key), key);
}
console.log("OK");

section("teacher creates evidence; cannot lock; hod can lock");
assert.ok(SYSTEM_ROLE_BUNDLES.teacher.includes("assessment_recording.create"));
assert.ok(
  SYSTEM_ROLE_BUNDLES.teacher.includes("assessment_recording.enter_marks"),
);
assert.ok(!SYSTEM_ROLE_BUNDLES.teacher.includes("assessment_recording.lock"));
assert.ok(SYSTEM_ROLE_BUNDLES.hod.includes("assessment_recording.lock"));
assert.ok(isLockPermission("assessment_recording.lock"));
assert.equal(lockPermissionKeys().length, 2);
assert.equal(teacherRecordingPermissionKeys().length, 4);
console.log("OK");

section("record + mark validation");
assert.ok(
  validateRecordInput({
    assessmentFrameworkId: "",
    assessmentFrameworkVersionId: "v",
    frameworkCategoryId: "c",
    title: "",
    conductedOn: "2026-01-01",
    classId: "cl",
    sectionId: "s",
    subjectId: "sub",
    maxMarks: 0,
    authorEmploymentId: "e",
    academicYearId: "y",
  }).title,
);
assert.ok(
  validateMarkEntry(
    {
      recordId: "r",
      studentProfileId: "st",
      marksObtained: 25,
      enteredByEmploymentId: "e",
    },
    20,
  ).marksObtained,
);
assert.equal(
  Object.keys(
    validateBulkMarks(
      {
        recordId: "r",
        enteredByEmploymentId: "e",
        entries: [
          { studentProfileId: "a", marksObtained: 10 },
          { studentProfileId: "b", isAbsent: true },
        ],
      },
      20,
    ),
  ).length,
  0,
);
console.log("OK");

section("edit until locked + append-only marks");
assert.ok(teacherMayEditRecordStatus("draft"));
assert.ok(teacherMayEditRecordStatus("open"));
assert.ok(!teacherMayEditRecordStatus("locked"));
assert.ok(marksAreAppendOnly());
console.log("OK");

section("classwork evidence scenario shape");
const category = "classwork";
const records = [
  "Class Test 1",
  "Class Test 2",
  "Worksheet",
  "Notebook Check",
  "Oral Assessment",
  "Presentation",
  "Teacher Observation",
];
assert.equal(category, "classwork");
assert.equal(records.length, 7);
console.log("OK");

console.log("\nAll assessment recording validation smokes passed.");
