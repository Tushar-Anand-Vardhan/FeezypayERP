/**
 * Student dirty-check smoke (no DB).
 * Run: npx tsx scripts/smoke-student-dirty-check.ts
 */
import assert from "node:assert/strict";
import {
  studentListFingerprint,
  studentListsEquivalent,
  type StudentFormRow,
} from "../lib/onboarding/students";

function row(patch: Partial<StudentFormRow> = {}): StudentFormRow {
  return {
    fullName: "Aarav Sharma",
    dateOfBirth: "2014-04-01",
    gender: "male",
    admissionNumber: "ADM001",
    aadhaar: "",
    email: "aarav@school.test",
    className: "Class 6",
    sectionName: "Rose",
    guardians: [
      {
        fullName: "Rina Sharma",
        relationship: "mother",
        phone: "9999999999",
        whatsappNumber: "9999999999",
        email: "rina@school.test",
        whatsappOptIn: false,
      },
    ],
    ...patch,
  };
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("same student list is equivalent regardless of order");
assert.equal(
  studentListsEquivalent(
    [row(), row({ admissionNumber: "ADM002", fullName: "Diya" })],
    [row({ admissionNumber: "ADM002", fullName: "Diya" }), row()],
  ),
  true,
);
console.log("OK");

section("class alias 6 matches Class 6; masked aadhaar ignored");
assert.equal(
  studentListsEquivalent(
    [row({ className: "6", aadhaar: "********1234" })],
    [row({ className: "Class 6", aadhaar: "" })],
  ),
  true,
);
console.log("OK");

section("whatsapp opt-in is not part of the fingerprint (not persisted)");
assert.equal(
  studentListsEquivalent(
    [row({ guardians: [{ ...row().guardians[0]!, whatsappOptIn: true }] })],
    [row()],
  ),
  true,
);
console.log("OK");

section("edit is detected");
assert.equal(
  studentListsEquivalent([row()], [row({ fullName: "Aarav Kumar" })]),
  false,
);
assert.notEqual(
  studentListFingerprint([row()]),
  studentListFingerprint([row({ sectionName: "Lotus" })]),
);
console.log("OK");

console.log("\nAll student dirty-check validations passed.");
