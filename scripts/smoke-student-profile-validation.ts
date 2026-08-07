/**
 * Student Profile Engine smoke tests (no DB).
 * Run: npx tsx scripts/smoke-student-profile-validation.ts
 */
import assert from "node:assert/strict";
import { STUDENT_PROFILE_MODULES } from "../lib/student-profile/catalog";
import { loadAiSummary } from "../lib/student-profile/loaders";
import type { StudentProfileModuleId } from "../lib/student-profile/types";
import {
  trimPersonalInput,
  validatePersonalInput,
} from "../lib/student-profile/validation";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("module catalogue");
const ids = STUDENT_PROFILE_MODULES.map((m) => m.id);
const required: StudentProfileModuleId[] = [
  "personal",
  "admission",
  "academic_history",
  "attendance",
  "assessments",
  "report_cards",
  "events",
  "competitions",
  "achievements",
  "behaviour",
  "medical",
  "documents",
  "parents",
  "transport",
  "house",
  "club_membership",
  "ai_summary",
];
for (const id of required) {
  assert.ok(ids.includes(id), `missing module ${id}`);
}
assert.equal(new Set(ids).size, ids.length);
assert.ok(STUDENT_PROFILE_MODULES.every((m) => m.ownerEngine.length > 0));
console.log("OK", ids.length, "modules");

section("personal validation");
const bad = validatePersonalInput({
  studentProfileId: "",
  fullName: "",
  email: "not-an-email",
});
assert.ok(bad.studentProfileId);
assert.ok(bad.fullName);
assert.ok(bad.email);
const ok = validatePersonalInput(
  trimPersonalInput({
    studentProfileId: " abc ",
    fullName: " Test Student ",
    gender: "female",
  }),
);
assert.equal(Object.keys(ok).length, 0);
console.log("OK");

section("ai summary placeholder");
const ai = loadAiSummary();
assert.equal(ai.source, "placeholder");
assert.equal(ai.data.status, "not_built");
assert.ok(ai.data.inputModuleIds.includes("attendance"));
console.log("OK");

console.log("\nAll student profile smoke checks passed.");
