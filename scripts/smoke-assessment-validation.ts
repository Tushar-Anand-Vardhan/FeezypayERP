/**
 * Assessment Configuration Engine validation smoke tests (no DB).
 * Run: npx tsx scripts/smoke-assessment-validation.ts
 */
import assert from "node:assert/strict";
import {
  ensureCategoryCode,
  ensureExamTypeCode,
  isArchiveBlocked,
  isEditBlocked,
  lockRulesFromJson,
  lockRulesToJson,
  normalizeLockRules,
  normalizePublishRules,
  publishRulesFromJson,
  publishRulesToJson,
  validateAssessmentCategoryInput,
  validateAssessmentComponentInput,
  validateAssessmentPolicyInput,
  validateExamDefinitionInput,
  validateExamSubjectScheduleInput,
  validateExamTypeInput,
} from "../lib/assessment/validation";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("ensureExamTypeCode / ensureCategoryCode");
assert.equal(ensureExamTypeCode("Unit Test", ""), "UNIT-TEST");
assert.equal(ensureCategoryCode("Internal", "int"), "INT");
console.log("OK");

section("validateExamTypeInput");
assert.ok(validateExamTypeInput({ name: "" }).name);
assert.ok(
  validateExamTypeInput({
    name: "Quiz",
    defaultMaxMarks: 20,
    defaultPassMarks: 25,
  }).defaultPassMarks,
);
assert.equal(
  Object.keys(
    validateExamTypeInput({
      name: "Quiz",
      defaultWeightagePercent: 10,
      defaultMaxMarks: 20,
      defaultPassMarks: 7,
    }),
  ).length,
  0,
);
console.log("OK");

section("validateAssessmentCategoryInput");
assert.ok(
  validateAssessmentCategoryInput({
    name: "Theory",
    kind: "not-a-kind" as "theory",
  }).kind,
);
assert.equal(
  Object.keys(
    validateAssessmentCategoryInput({ name: "Practical", kind: "practical" }),
  ).length,
  0,
);
console.log("OK");

section("validateAssessmentPolicyInput");
assert.ok(validateAssessmentPolicyInput({ defaultPassPercent: 120 }).defaultPassPercent);
assert.equal(Object.keys(validateAssessmentPolicyInput({ defaultPassPercent: 33 })).length, 0);
console.log("OK");

section("validateExamDefinitionInput");
const examBad = validateExamDefinitionInput({
  academicYearId: "",
  name: "",
  weightagePercent: 150,
  maxMarks: 50,
  passMarks: 60,
});
assert.ok(examBad.academicYearId);
assert.ok(examBad.name);
assert.ok(examBad.weightagePercent);
assert.ok(examBad.passMarks);

const examOk = validateExamDefinitionInput({
  academicYearId: "year-1",
  name: "Midterm",
  category: "midterm",
  weightagePercent: 30,
  maxMarks: 80,
  passMarks: 26,
  publishingStatus: "draft",
});
assert.equal(Object.keys(examOk).length, 0);
console.log("OK");

section("validateAssessmentComponentInput");
assert.ok(
  validateAssessmentComponentInput({
    examDefinitionId: "e1",
    componentType: "practical",
    name: "",
  }).name,
);
assert.equal(
  Object.keys(
    validateAssessmentComponentInput({
      examDefinitionId: "e1",
      componentType: "internal",
      name: "IA",
      weightagePercent: 20,
      maxMarks: 40,
      passMarks: 13,
    }),
  ).length,
  0,
);
console.log("OK");

section("validateExamSubjectScheduleInput");
assert.ok(
  validateExamSubjectScheduleInput({
    examDefinitionId: "e1",
    subjectId: "",
    classId: "c1",
  }).subjectId,
);
assert.equal(
  Object.keys(
    validateExamSubjectScheduleInput({
      examDefinitionId: "e1",
      subjectId: "s1",
      classId: "c1",
      isOptionalSubject: true,
      componentType: "project",
      maxMarks: 50,
      passMarks: 17,
    }),
  ).length,
  0,
);
console.log("OK");

section("publish/lock rules JSON round-trip");
const pub = normalizePublishRules({
  visibleToParents: true,
  requireSchedules: true,
});
const pubJson = publishRulesToJson(pub);
assert.equal(pubJson.visible_to_parents, true);
assert.equal(publishRulesFromJson(pubJson).visibleToParents, true);

const lock = normalizeLockRules({ lockOnPublish: false });
const lockJson = lockRulesToJson(lock);
assert.equal(lockJson.lock_on_publish, false);
assert.equal(lockRulesFromJson(lockJson).lockOnPublish, false);
console.log("OK");

section("lock gate helpers");
assert.equal(isEditBlocked("draft", { preventEditWhenLocked: true }), false);
assert.equal(isEditBlocked("locked", { preventEditWhenLocked: true }), true);
assert.equal(isEditBlocked("locked", { preventEditWhenLocked: false }), false);
assert.equal(
  isArchiveBlocked("locked", { preventArchiveWhenLocked: true }),
  true,
);
console.log("OK");

console.log("\nAll assessment validation checks passed.");
