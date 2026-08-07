/**
 * Assessment Framework Engine (E31) validation smoke tests (no DB).
 * Run: npx tsx scripts/smoke-assessment-framework-validation.ts
 */
import assert from "node:assert/strict";
import { PERMISSION_KEYS } from "../lib/authz/catalog";
import { SYSTEM_ROLE_BUNDLES } from "../lib/authz/bundles";
import { ensureFrameworkCode } from "../lib/assessment-framework/codes";
import { buildFrameworkSnapshotJson } from "../lib/assessment-framework/snapshot";
import type { FrameworkSnapshot } from "../lib/assessment-framework/types";
import {
  exampleTerm1FormulaParts,
  frameworkWritePermissionKeys,
  isFrameworkWritePermission,
  validateCategoryInput,
  validateCloneFrameworkInput,
  validateFormulaParts,
  validateFrameworkInput,
} from "../lib/assessment-framework/validation";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("permission keys in catalog");
for (const key of [
  "assessment_framework.read",
  "assessment_framework.edit",
  "assessment_framework.publish",
  "assessment_framework.archive",
  "assessment_framework.clone",
] as const) {
  assert.ok((PERMISSION_KEYS as readonly string[]).includes(key), key);
}
console.log("OK");

section("teachers read-only; hod has write set");
assert.ok(SYSTEM_ROLE_BUNDLES.teacher.includes("assessment_framework.read"));
assert.ok(!SYSTEM_ROLE_BUNDLES.teacher.includes("assessment_framework.edit"));
assert.ok(!SYSTEM_ROLE_BUNDLES.teacher.includes("assessment_framework.publish"));
assert.ok(SYSTEM_ROLE_BUNDLES.hod.includes("assessment_framework.edit"));
assert.ok(SYSTEM_ROLE_BUNDLES.hod.includes("assessment_framework.clone"));
assert.ok(isFrameworkWritePermission("assessment_framework.edit"));
assert.equal(frameworkWritePermissionKeys().length, 4);
console.log("OK");

section("framework + category validation");
assert.ok(
  validateFrameworkInput({
    academicYearId: "",
    classId: "c",
    subjectId: "s",
    name: "",
  }).name,
);
assert.equal(
  Object.keys(
    validateFrameworkInput({
      academicYearId: "y",
      classId: "c",
      subjectId: "s",
      name: "Class 8 Math",
    }),
  ).length,
  0,
);
assert.ok(
  validateCategoryInput({
    frameworkId: "f",
    name: "Periodic",
    weightagePercent: 120,
  }).weightagePercent,
);
assert.ok(
  validateCategoryInput({
    frameworkId: "f",
    name: "Practical",
    maxMarks: 20,
    passMarks: 25,
  }).passMarks,
);
console.log("OK");

section("Term 1 formula weights (50/30/20)");
const parts = exampleTerm1FormulaParts();
assert.equal(Object.keys(validateFormulaParts(parts)).length, 0);
assert.ok(validateFormulaParts([{ categoryId: "a", weightPercent: 40 }]).parts);
console.log("OK");

section("clone + codes");
assert.ok(
  validateCloneFrameworkInput({
    sourceFrameworkId: "",
    targetAcademicYearId: "y",
  }).sourceFrameworkId,
);
assert.equal(ensureFrameworkCode("Class 8 Maths", ""), "CLASS_8_MATHS");
console.log("OK");

section("snapshot round-trip");
const tree: FrameworkSnapshot = {
  framework: { id: "f1", name: "Math" },
  categories: [
    { id: "c1", name: "Classwork", category_kind: "classwork" },
    { id: "c2", name: "Periodic", category_kind: "periodic_test" },
  ],
  formulas: [{ id: "fm1", name: "Term 1" }],
  formulaParts: [
    { formula_id: "fm1", category_id: "c1", weight_percent: 50 },
    { formula_id: "fm1", category_id: "c2", weight_percent: 50 },
  ],
};
const snap = buildFrameworkSnapshotJson(tree);
assert.equal(snap.categories.length, 2);
assert.notEqual(snap.formulas[0], tree.formulas[0]);
console.log("OK");

console.log("\nAll assessment framework validation smokes passed.");
