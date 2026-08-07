/**
 * Subject Configuration Engine validation smoke tests (no DB).
 * Run: npx tsx scripts/smoke-subject-validation.ts
 */
import assert from "node:assert/strict";
import { ensureSubjectGroupCode } from "../lib/subjects/codes";
import {
  validateAssessmentRules,
  validateSubjectDependencyInput,
  validateSubjectGroupInput,
  validateSubjectMasterInput,
} from "../lib/subjects/validation";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("ensureSubjectGroupCode");
assert.equal(ensureSubjectGroupCode("Sciences", ""), "SCIENCES");
console.log("OK");

section("validateSubjectGroupInput");
assert.ok(validateSubjectGroupInput({ name: "" }).name);
assert.equal(Object.keys(validateSubjectGroupInput({ name: "Languages" })).length, 0);
console.log("OK");

section("validateSubjectMasterInput");
const masterBad = validateSubjectMasterInput({
  name: "",
  credits: 150,
  weeklyPeriods: 50,
  languageCode: "123",
});
assert.ok(masterBad.name);
assert.ok(masterBad.credits, "expected credits error");
assert.ok(masterBad.weeklyPeriods, "expected weeklyPeriods error");
assert.ok(masterBad.languageCode, "expected languageCode error");

const masterOk = validateSubjectMasterInput({
  name: "Physics",
  code: "PHY",
  category: "scholastic",
  credits: 4,
  weeklyPeriods: 5,
  requiresLab: true,
  assessmentRules: {
    gradingType: "marks",
    maxMarks: 100,
    passMarks: 33,
    hasPractical: true,
    practicalWeightage: 30,
  },
});
assert.equal(Object.keys(masterOk).length, 0);
console.log("OK");

section("validateAssessmentRules");
const rulesBad = validateAssessmentRules({
  gradingType: "marks",
  maxMarks: 50,
  passMarks: 60,
});
assert.ok(rulesBad.passMarks);
console.log("OK");

section("validateSubjectDependencyInput");
const depSelf = validateSubjectDependencyInput({
  subjectId: "a",
  dependsOnSubjectId: "a",
});
assert.ok(depSelf.dependsOnSubjectId);
const depOk = validateSubjectDependencyInput({
  subjectId: "a",
  dependsOnSubjectId: "b",
  dependencyType: "prerequisite",
});
assert.equal(Object.keys(depOk).length, 0);
console.log("OK");

console.log("\nAll subject validation checks passed.");
