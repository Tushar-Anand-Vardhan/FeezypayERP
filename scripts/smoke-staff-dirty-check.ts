/**
 * Staff dirty-check smoke (no DB).
 * Run: npx tsx scripts/smoke-staff-dirty-check.ts
 */
import assert from "node:assert/strict";
import {
  clearMaskedStaffAadhaar,
  staffListFingerprint,
  staffListsEquivalent,
  type StaffFormRow,
} from "../lib/onboarding/staff";

function row(patch: Partial<StaffFormRow> = {}): StaffFormRow {
  return {
    fullName: "Priya Sharma",
    phone: "9999999999",
    email: "priya@school.test",
    aadhaar: "",
    employeeCode: "TCH01",
    designation: "Teacher",
    departmentName: "Science",
    subjectNames: ["Math", "Science"],
    isHod: false,
    ...patch,
  };
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("masked aadhaar clears for compare");
assert.deepEqual(
  clearMaskedStaffAadhaar([row({ aadhaar: "********1234" })])[0]?.aadhaar,
  "",
);
console.log("OK");

section("same staff list is equivalent regardless of order/subject order");
assert.equal(
  staffListsEquivalent(
    [row(), row({ email: "other@school.test", employeeCode: "TCH02" })],
    [
      row({
        email: "other@school.test",
        employeeCode: "TCH02",
        subjectNames: ["Science", "Math"],
      }),
      row({ aadhaar: "********9999", subjectNames: ["Science", "Math"] }),
    ],
  ),
  true,
);
console.log("OK");

section("edit is detected");
assert.equal(
  staffListsEquivalent([row()], [row({ designation: "Senior Teacher" })]),
  false,
);
assert.notEqual(
  staffListFingerprint([row()]),
  staffListFingerprint([row({ isHod: true })]),
);
console.log("OK");

console.log("\nAll staff dirty-check validations passed.");
