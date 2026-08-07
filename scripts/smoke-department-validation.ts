/**
 * Department Engine validation smoke tests (no DB).
 * Run: npx tsx scripts/smoke-department-validation.ts
 */
import assert from "node:assert/strict";
import { ensureDepartmentCode } from "../lib/departments/codes";
import {
  validateAnnouncementInput,
  validateDepartmentInput,
  validateMembershipInput,
  validateResourceInput,
  validateTeachingAssignmentInput,
} from "../lib/departments/validation";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("ensureDepartmentCode");
assert.equal(ensureDepartmentCode("Science", ""), "SCIENCE");
assert.equal(ensureDepartmentCode("Science", "sci"), "SCI");
console.log("OK");

section("validateDepartmentInput");
const deptErrors = validateDepartmentInput({ name: "" });
assert.ok(deptErrors.name);
const deptOk = validateDepartmentInput({ name: "Mathematics", code: "MATH" });
assert.equal(Object.keys(deptOk).length, 0);
console.log("OK");

section("validateMembershipInput");
const memErrors = validateMembershipInput({
  departmentId: "",
  employmentId: "",
  // @ts-expect-error intentional
  role: "owner",
});
assert.ok(memErrors.departmentId);
assert.ok(memErrors.employmentId);
assert.ok(memErrors.role);
const memOk = validateMembershipInput({
  departmentId: "d1",
  employmentId: "e1",
  role: "head",
});
assert.equal(Object.keys(memOk).length, 0);
console.log("OK");

section("validateTeachingAssignmentInput");
const assignErrors = validateTeachingAssignmentInput({
  departmentId: "d1",
  employmentId: "",
  subjectId: "s1",
  startedOn: "bad",
});
assert.ok(assignErrors.employmentId);
assert.ok(assignErrors.startedOn);
console.log("OK");

section("validateAnnouncementInput");
const annOk = validateAnnouncementInput({
  departmentId: "d1",
  title: "Lab safety",
  visibility: "department",
  status: "draft",
});
assert.equal(Object.keys(annOk).length, 0);
const annBad = validateAnnouncementInput({
  departmentId: "d1",
  title: "",
});
assert.ok(annBad.title);
console.log("OK");

section("validateResourceInput");
const resBad = validateResourceInput({
  departmentId: "d1",
  title: "Guide",
  resourceType: "link",
  url: "ftp://example.com",
});
assert.ok(resBad.url);
const resOk = validateResourceInput({
  departmentId: "d1",
  title: "Guide",
  resourceType: "link",
  url: "https://example.com/guide",
});
assert.equal(Object.keys(resOk).length, 0);
console.log("OK");

console.log("\nAll department validation checks passed.");
