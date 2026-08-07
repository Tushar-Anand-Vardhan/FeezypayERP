/**
 * Configuration Engine validation smoke tests (no DB).
 * Run: npx tsx scripts/smoke-config-validation.ts
 */
import assert from "node:assert/strict";
import { ensureHouseCode, ensureSubjectCode, slugCode } from "../lib/config/codes";
import { validateGradingScaleInput } from "../lib/config/grading-scales";
import { validateClubInputs, validateHouseInputs } from "../lib/config/houses";
import { validateSchoolBrandingInput } from "../lib/config/school-branding";
import { validateSubjectInputs } from "../lib/config/subjects";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("slugCode");
assert.equal(slugCode("Physics Lab"), "PHYSICS-LAB");
assert.ok(slugCode("@@@").startsWith("ITEM-"));
console.log("OK");

section("ensureSubjectCode");
assert.equal(ensureSubjectCode("Mathematics", ""), "MATHEMATICS");
assert.equal(ensureSubjectCode("Mathematics", "math"), "MATH");
console.log("OK");

section("ensureHouseCode");
assert.equal(ensureHouseCode("Red House", "red"), "RED");
console.log("OK");

section("validateSubjectInputs duplicates");
const subjectErrors = validateSubjectInputs([
  { name: "Physics", type: "scholastic" },
  { name: "physics", type: "scholastic" },
]);
assert.ok(subjectErrors["subject-0-name"]);
assert.ok(subjectErrors["subject-1-name"]);
console.log("OK blocked duplicate names");

section("validateSubjectInputs require one");
const emptyErrors = validateSubjectInputs([], { requireAtLeastOne: true });
assert.equal(emptyErrors.form, "Add at least one subject.");
console.log("OK");

section("validateHouseInputs");
const houseErrors = validateHouseInputs([{ name: "" }], {
  requireAtLeastOne: true,
});
assert.ok(houseErrors.houses || houseErrors["house-0-name"]);
console.log("OK");

section("validateClubInputs");
const clubOk = validateClubInputs([{ name: "Chess", description: "" }]);
assert.equal(Object.keys(clubOk).length, 0);
console.log("OK");

section("validateGradingScaleInput");
const scaleErrors = validateGradingScaleInput({
  code: "CBSE",
  name: "CBSE",
  bands: [{ min: 90, max: 80, grade: "A" }],
});
assert.ok(scaleErrors["band-0"]);
const scaleOk = validateGradingScaleInput({
  code: "CBSE",
  name: "CBSE Marks",
  bands: [
    { min: 91, max: 100, grade: "A1" },
    { min: 81, max: 90, grade: "A2" },
  ],
});
assert.equal(Object.keys(scaleOk).length, 0);
console.log("OK");

section("validateSchoolBrandingInput");
const brandingErrors = validateSchoolBrandingInput({
  name: "",
  addressStreet: "",
  addressCity: "",
  addressState: "",
  addressPincode: "12",
  contactPhone: "abc",
  contactEmail: "bad",
  board: "",
  affiliationNumber: "",
});
assert.ok(brandingErrors.name);
assert.ok(brandingErrors.board);
assert.ok(brandingErrors.addressPincode);
assert.ok(brandingErrors.contactPhone);
assert.ok(brandingErrors.contactEmail);
console.log("OK");

console.log("\nAll config validation checks passed.");
