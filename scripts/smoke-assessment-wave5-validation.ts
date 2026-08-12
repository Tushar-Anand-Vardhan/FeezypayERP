/**
 * Wave 5 assessment schedules / rubrics smoke (no DB).
 * Run: npx tsx scripts/smoke-assessment-wave5-validation.ts
 */
import assert from "node:assert/strict";
import {
  ensureRubricCode,
  validateRubricInput,
} from "../lib/assessment/rubrics";
import type { ExamSubjectScheduleInput } from "../lib/assessment/types";
import { validateExamSubjectScheduleInput } from "../lib/assessment/validation";
import { onboardingStepsCoveredByHub } from "../lib/config-dashboard/hub-tabs";
import { CONFIG_DASHBOARD_MODULES } from "../lib/config-dashboard/catalog";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("schedule validation");
const base: ExamSubjectScheduleInput = {
  examDefinitionId: "e1",
  subjectId: "s1",
  classId: "c1",
  startsAt: "2026-09-01T09:00:00.000Z",
  endsAt: "2026-09-01T12:00:00.000Z",
  dayKind: "half_day",
  markingOpensAt: "2026-09-01T12:00:00.000Z",
  markingClosesAt: "2026-09-05T18:00:00.000Z",
};
assert.equal(Object.keys(validateExamSubjectScheduleInput(base)).length, 0);

const badEnd = validateExamSubjectScheduleInput({
  ...base,
  endsAt: "2026-08-01T09:00:00.000Z",
});
assert.ok(badEnd.endsAt);

const rubricNeedsId = validateExamSubjectScheduleInput({
  ...base,
  gradingType: "rubric",
});
assert.ok(rubricNeedsId.rubricId);

const rubricOk = validateExamSubjectScheduleInput({
  ...base,
  gradingType: "rubric",
  rubricId: "r1",
});
assert.equal(Object.keys(rubricOk).length, 0);
console.log("OK");

section("rubric helpers");
assert.equal(ensureRubricCode("Oral fluency"), "ORAL_FLUENCY");
assert.ok(validateRubricInput({ name: "" }).name);
assert.equal(
  Object.keys(
    validateRubricInput({
      name: "Speaking",
      criteria: [{ name: "Fluency", maxScore: 4 }],
    }),
  ).length,
  0,
);
console.log("OK");

section("catalog hrefs");
const assessment = CONFIG_DASHBOARD_MODULES.find((m) => m.id === "assessment");
const reportCards = CONFIG_DASHBOARD_MODULES.find((m) => m.id === "report_cards");
assert.equal(assessment?.href, "/dashboard/assessments");
assert.equal(reportCards?.href, "/dashboard/report-cards");
assert.ok(onboardingStepsCoveredByHub());
console.log("OK");

console.log("\nAll Wave 5 assessment smoke checks passed.");
