/**
 * School Policy Engine validation smoke tests (no DB).
 * Run: npx tsx scripts/smoke-policy-validation.ts
 */
import assert from "node:assert/strict";
import { defaultRulesForKind } from "../lib/policies/defaults";
import {
  POLICY_KINDS,
  FUTURE_POLICY_KINDS,
} from "../lib/policies/types";
import {
  ensurePolicyCode,
  isFuturePolicyKind,
  mergeDefaultRules,
  validatePolicyInput,
  validatePolicyRules,
  validatePolicyVersionInput,
} from "../lib/policies/validation";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("kinds inventory");
assert.equal(POLICY_KINDS.length, 12);
assert.ok(POLICY_KINDS.includes("attendance_rules"));
assert.ok(POLICY_KINDS.includes("fee_rules"));
assert.ok(isFuturePolicyKind("transport_rules"));
assert.equal(FUTURE_POLICY_KINDS.length, 2);
console.log("OK");

section("ensurePolicyCode");
assert.equal(ensurePolicyCode("late_arrival", "Late", "LATE"), "LATE");
assert.ok(ensurePolicyCode("grace_marks", "Grace", "").includes("GRACE"));
console.log("OK");

section("validatePolicyInput");
assert.ok(validatePolicyInput({ name: "", policyKind: "attendance_rules" }).name);
assert.ok(
  validatePolicyInput({
    name: "X",
    policyKind: "nope" as "attendance_rules",
  }).policyKind,
);
assert.equal(
  Object.keys(
    validatePolicyInput({ name: "Attendance", policyKind: "attendance_rules" }),
  ).length,
  0,
);
console.log("OK");

section("defaultRulesForKind coverage");
for (const kind of POLICY_KINDS) {
  const rules = defaultRulesForKind(kind);
  assert.equal(typeof rules, "object");
  assert.ok(rules);
}
console.log("OK");

section("validatePolicyRules — attendance / promotion");
assert.ok(
  validatePolicyRules("attendance_rules", { min_attendance_percent: 120 })
    .min_attendance_percent,
);
assert.equal(
  Object.keys(
    validatePolicyRules("attendance_rules", defaultRulesForKind("attendance_rules")),
  ).length,
  0,
);
assert.ok(
  validatePolicyRules("promotion_rules", { max_failed_subjects: -1 })
    .max_failed_subjects,
);
console.log("OK");

section("validatePolicyRules — timings / leave / late / half");
assert.ok(
  validatePolicyRules("working_hours", {
    staff_start: "15:00",
    staff_end: "08:00",
  }).staff_end,
);
assert.ok(validatePolicyRules("school_timings", { days: [] }).days);
assert.ok(validatePolicyRules("leave_types", { types: [] }).types);
assert.equal(
  Object.keys(
    validatePolicyRules("leave_types", defaultRulesForKind("leave_types")),
  ).length,
  0,
);
assert.ok(
  validatePolicyRules("late_arrival", { grace_minutes: -5 }).grace_minutes,
);
assert.equal(
  Object.keys(
    validatePolicyRules("half_day", {
      morning_cutoff: "11:00",
      afternoon_start: "11:00",
      min_present_minutes: 180,
    }),
  ).length,
  0,
);
console.log("OK");

section("validatePolicyRules — exam / grace / behaviour");
assert.ok(
  validatePolicyRules("exam_eligibility", { min_attendance_percent: -1 })
    .min_attendance_percent,
);
assert.ok(
  validatePolicyRules("grace_marks", { max_grace_marks_per_subject: -1 })
    .max_grace_marks_per_subject,
);
assert.equal(
  Object.keys(
    validatePolicyRules("behaviour_rules", defaultRulesForKind("behaviour_rules")),
  ).length,
  0,
);
console.log("OK");

section("version input + merge defaults");
const merged = mergeDefaultRules("grace_marks", { enabled: true });
assert.equal(merged.enabled, true);
assert.ok(typeof merged.max_grace_marks_per_subject === "number");
assert.ok(
  validatePolicyVersionInput("attendance_rules", {
    policyId: "p1",
    rules: { min_attendance_percent: 75 },
    effectiveFrom: "2026-04-01",
    effectiveTo: "2026-03-01",
  }).effectiveTo,
);
console.log("OK");

console.log("\nAll school policy validation checks passed.");
