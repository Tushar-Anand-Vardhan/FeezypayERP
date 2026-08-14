/**
 * Onboarding exam-row validation smoke tests (no DB).
 * Run: npx tsx scripts/smoke-exams-validation.ts
 */
import assert from "node:assert/strict";
import {
  copyExamsToClass,
  emptyExam,
  validateExamRows,
  type ExamFormRow,
} from "../lib/onboarding/exams";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

function row(patch: Partial<ExamFormRow>): ExamFormRow {
  return emptyExam({
    classId: "c6",
    name: "Unit Test 1",
    termId: "t1",
    ...patch,
  });
}

section("empty exam needs class + name + term");
const missing = validateExamRows([emptyExam()]);
assert.ok(missing["exam-0-classId"]);
assert.ok(missing["exam-0-name"]);
assert.ok(missing["exam-0-termId"]);
console.log("OK");

section("same name allowed across classes");
assert.equal(
  Object.keys(
    validateExamRows([
      row({ classId: "c6", name: "Unit Test 1" }),
      row({ classId: "c7", name: "Unit Test 1" }),
    ]),
  ).length,
  0,
);
console.log("OK");

section("duplicate name blocked within a class");
const dup = validateExamRows([
  row({ classId: "c6", name: "UT 1" }),
  row({ classId: "c6", name: "ut 1" }),
]);
assert.ok(dup["exam-1-name"]);
console.log("OK");

section("unknown class id rejected when class set provided");
const unknown = validateExamRows([row({ classId: "c9" })], {
  classIds: new Set(["c6", "c7"]),
});
assert.ok(unknown["exam-0-classId"]);
console.log("OK");

section("continue requires at least one exam overall");
const none = validateExamRows([], { requireAtLeastOne: true });
assert.ok(none.form);
console.log("OK");

section("copy exams to another class replaces target");
const copied = copyExamsToClass(
  [
    row({ classId: "c6", name: "Midterm", maxMarks: "80" }),
    row({ classId: "c7", name: "Old" }),
  ],
  "c6",
  "c7",
);
assert.equal(copied.length, 2);
assert.equal(
  copied.filter((exam) => exam.classId === "c7")[0]?.name,
  "Midterm",
);
assert.equal(
  copied.filter((exam) => exam.classId === "c6")[0]?.maxMarks,
  "80",
);
console.log("OK");

console.log("\nAll exam onboarding validation checks passed.");
