/**
 * Pure validation smoke for Behaviour Engine (E13).
 * Run: npx tsx scripts/smoke-behaviour-validation.ts
 */

import {
  FOLLOW_UP_ACTION_TYPES,
  REMARK_KINDS,
  REMARK_VISIBILITIES,
} from "../lib/behaviour/types";
import {
  defaultSeverityForKind,
  validateCreateFollowUpInput,
  validateCreateRemarkInput,
  validateAnalyticsQuery,
  visibilityFlags,
} from "../lib/behaviour/validation";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("=== remark kinds ===");
for (const k of [
  "positive",
  "disciplinary",
  "warning",
  "commendation",
  "teacher_note",
] as const) {
  assert(REMARK_KINDS.includes(k), k);
}
console.log("OK");

console.log("=== visibility ===");
assert(REMARK_VISIBILITIES.includes("private"), "private");
assert(REMARK_VISIBILITIES.includes("parent_visible"), "parent_visible");
assert(!visibilityFlags("private").visible_to_guardians, "private hide");
assert(visibilityFlags("parent_visible").visible_to_guardians, "parent show");
assert(visibilityFlags("school").visible_to_students, "school students");
assert(!visibilityFlags("staff").visible_to_guardians, "staff hide parents");
console.log("OK");

console.log("=== create remark validation ===");
{
  const bad = validateCreateRemarkInput({
    studentProfileId: "",
    academicYearId: "",
    remarkKind: "disciplinary",
    title: "",
  });
  assert(bad.studentProfileId && bad.academicYearId && bad.title, "required");

  const good = validateCreateRemarkInput({
    studentProfileId: "s1",
    academicYearId: "y1",
    remarkKind: "positive",
    title: "Helped peer",
    visibility: "parent_visible",
    followUpRequired: false,
  });
  assert(Object.keys(good).length === 0, "good positive");

  const note = validateCreateRemarkInput({
    studentProfileId: "s1",
    academicYearId: "y1",
    remarkKind: "teacher_note",
    title: "Private observation",
    visibility: "private",
  });
  assert(Object.keys(note).length === 0, "private teacher note");
}
console.log("OK");

console.log("=== follow-up + analytics ===");
assert(FOLLOW_UP_ACTION_TYPES.includes("parent_call"), "parent_call");
assert(FOLLOW_UP_ACTION_TYPES.includes("counseling"), "counseling");
{
  const bad = validateCreateFollowUpInput({
    conductIncidentId: "",
    title: "",
  });
  assert(bad.conductIncidentId && bad.title, "follow-up req");
  const good = validateCreateFollowUpInput({
    conductIncidentId: "i1",
    title: "Call parent",
    actionType: "parent_call",
    dueOn: "2026-08-10",
  });
  assert(Object.keys(good).length === 0, "good follow-up");
  const aBad = validateAnalyticsQuery({ academicYearId: "" });
  assert(aBad.academicYearId, "analytics year");
  const aGood = validateAnalyticsQuery({ academicYearId: "y1" });
  assert(Object.keys(aGood).length === 0, "analytics ok");
}
console.log("OK");

console.log("=== defaults ===");
assert(defaultSeverityForKind("warning") === "medium", "warn severity");
assert(defaultSeverityForKind("commendation") === "low", "commend severity");
console.log("OK");

console.log("\nAll behaviour smoke checks passed.");
