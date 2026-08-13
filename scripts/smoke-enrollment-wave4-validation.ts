/**
 * Wave 4 enrollment / roll / affiliation smoke (no DB).
 * Run: npx tsx scripts/smoke-enrollment-wave4-validation.ts
 */
import assert from "node:assert/strict";
import {
  D14_ACTIVE_ADMISSION_MESSAGE,
} from "../lib/enrollment/admission-guards";
import {
  assignRollNumbers,
  isRollStrategy,
  ROLL_STRATEGIES,
} from "../lib/enrollment/roll-assignment";
import { ENROLLMENT_CSV_HEADERS } from "../lib/enrollment/csv";
import {
  HOUSE_MEMBERSHIP_CSV_HEADERS,
  parseHouseMembershipCsv,
} from "../lib/houses-clubs/house-memberships-csv";
import {
  D15_ACTIVE_EMPLOYMENT_MESSAGE,
} from "../lib/workforce/employment-guards";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("roll strategies");
assert.ok(isRollStrategy("random"));
assert.ok(!isRollStrategy("nope"));
const people = [
  { studentAcademicYearId: "1", fullName: "Zara Ahmed" },
  { studentAcademicYearId: "2", fullName: "Aman Kumar" },
  { studentAcademicYearId: "3", fullName: "Bina Devi" },
];
const byFirst = assignRollNumbers(people, "sort_first_asc");
assert.equal(byFirst[0].studentAcademicYearId, "2"); // Aman
assert.equal(byFirst[0].rollNumber, "1");
assert.equal(byFirst[2].rollNumber, "3");
const byLast = assignRollNumbers(people, "sort_last_asc");
assert.equal(byLast.map((r) => r.studentAcademicYearId).join(","), "1,3,2"); // Ahmed, Devi, Kumar
const seq = assignRollNumbers(people, "sequential");
assert.equal(seq.map((r) => r.studentAcademicYearId).join(","), "1,2,3");
const rand = assignRollNumbers(people, "random");
assert.equal(new Set(rand.map((r) => r.rollNumber)).size, 3);
assert.equal(ROLL_STRATEGIES.length, 6);
console.log("OK");

section("csv headers");
assert.deepEqual([...ENROLLMENT_CSV_HEADERS], [
  "admission_number",
  "class_name",
  "section_name",
]);
assert.deepEqual([...HOUSE_MEMBERSHIP_CSV_HEADERS], [
  "admission_number",
  "house_code",
  "role",
]);
console.log("OK");

section("house membership csv parse");
const ok = parseHouseMembershipCsv(
  "admission_number,house_code,role\nA-1,RED,member\nA-2,BLUE,captain\n",
);
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.equal(ok.rows.length, 2);
  assert.equal(ok.rows[1].role, "captain");
}
const bad = parseHouseMembershipCsv(
  "admission_number,house_code,role\nA-1,RED,leader\n",
);
assert.equal(bad.ok, false);
console.log("OK");

section("affiliation messages");
assert.ok(D14_ACTIVE_ADMISSION_MESSAGE.includes("another school"));
assert.ok(D15_ACTIVE_EMPLOYMENT_MESSAGE.includes("leave"));
console.log("OK");

console.log("\nAll Wave 4 enrollment smoke checks passed.");
