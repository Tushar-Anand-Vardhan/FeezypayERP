/**
 * Grade Calculation Engine (E33) validation smoke tests (no DB).
 * Run: npx tsx scripts/smoke-grade-calculation-validation.ts
 */
import assert from "node:assert/strict";
import { PERMISSION_KEYS } from "../lib/authz/catalog";
import { SYSTEM_ROLE_BUNDLES } from "../lib/authz/bundles";
import {
  applyGrace,
  computeOverallFromSubjects,
  computeSubjectResult,
  defaultGradeBands,
  mapPercentageToGrade,
  validateFormulaPartsSum,
} from "../lib/grade-calculation/compute";
import {
  fingerprintInputs,
  stableStringify,
} from "../lib/grade-calculation/fingerprint";
import {
  adminCalcPermissionKeys,
  isAdminCalcPermission,
  teachersCannotRunCalculations,
  validateRunCalcInput,
} from "../lib/grade-calculation/validation";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("permission keys + teacher read-only");
for (const key of [
  "grade_calculation.read",
  "grade_calculation.configure",
  "grade_calculation.run",
  "grade_calculation.publish",
] as const) {
  assert.ok((PERMISSION_KEYS as readonly string[]).includes(key), key);
}
assert.ok(SYSTEM_ROLE_BUNDLES.teacher.includes("grade_calculation.read"));
assert.ok(!SYSTEM_ROLE_BUNDLES.teacher.includes("grade_calculation.run"));
assert.ok(SYSTEM_ROLE_BUNDLES.hod.includes("grade_calculation.run"));
assert.ok(teachersCannotRunCalculations());
assert.ok(isAdminCalcPermission("grade_calculation.publish"));
assert.equal(adminCalcPermissionKeys().length, 3);
console.log("OK");

section("Term 1 formula 50/30/20 → subject result");
const parts = [
  { categoryId: "classwork", weightPercent: 50 },
  { categoryId: "periodic", weightPercent: 30 },
  { categoryId: "practical", weightPercent: 20 },
];
assert.equal(validateFormulaPartsSum(parts), null);

const result = computeSubjectResult({
  studentProfileId: "stu1",
  subjectId: "math",
  formulaParts: parts,
  gradeBands: defaultGradeBands(),
  grace: { maxGraceMarks: 0, passPercent: 33 },
  categories: [
    {
      categoryId: "classwork",
      obtained: 80,
      maxMarks: 100,
      markRowIds: ["m1", "m2"],
    },
    {
      categoryId: "periodic",
      obtained: 70,
      maxMarks: 100,
      markRowIds: ["m3"],
    },
    {
      categoryId: "practical",
      obtained: 90,
      maxMarks: 100,
      markRowIds: ["m4"],
    },
  ],
});
// 0.5*80 + 0.3*70 + 0.2*90 = 40+21+18 = 79
assert.equal(result.percentage, 79);
assert.equal(result.letterGrade, "B1");
assert.equal(result.passStatus, "pass");
assert.ok(Array.isArray(result.breakdown.markRowIds));
console.log("OK");

section("grace lifts failing to pass ceiling");
const failing = computeSubjectResult({
  studentProfileId: "stu2",
  subjectId: "math",
  formulaParts: [{ categoryId: "c", weightPercent: 100 }],
  gradeBands: defaultGradeBands(),
  grace: {
    maxGraceMarks: 5,
    applyTo: "failing_only",
    ceilingPercent: 33,
    passPercent: 33,
  },
  categories: [
    { categoryId: "c", obtained: 30, maxMarks: 100, markRowIds: ["x"] },
  ],
});
assert.ok(failing.graceApplied > 0);
assert.equal(failing.passStatus, "pass");
assert.ok(failing.percentage >= 33);
console.log("OK");

section("letter grades + grade points");
const mapped = mapPercentageToGrade(95, defaultGradeBands());
assert.equal(mapped.letter, "A1");
assert.equal(mapped.gradePoints, 10);
const g = applyGrace(30, 30, 100, { maxGraceMarks: 0 }, 33);
assert.equal(g.graceApplied, 0);
console.log("OK");

section("overall from subjects + optional exclude");
const overall = computeOverallFromSubjects(
  [
    { ...result, subjectId: "math", studentProfileId: "stu1" },
    {
      ...result,
      subjectId: "art",
      percentage: 50,
      passStatus: "pass",
      studentProfileId: "stu1",
    },
  ],
  { excludeSubjectIds: new Set(["art"]) },
);
assert.equal(overall.percentage, 79);
console.log("OK");

section("reproducible fingerprint");
const snap = { a: 1, parts, percentage: result.percentage };
const fp1 = fingerprintInputs(snap);
const fp2 = fingerprintInputs({ percentage: result.percentage, parts, a: 1 });
assert.equal(fp1, fp2);
assert.notEqual(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 1 }));
assert.ok(
  validateRunCalcInput({
    academicYearId: "",
    classId: "c",
    assessmentFrameworkId: "f",
    assessmentFrameworkVersionId: "v",
    scope: "subject",
  }).academicYearId,
);
console.log("OK");

console.log("\nAll grade calculation validation smokes passed.");
