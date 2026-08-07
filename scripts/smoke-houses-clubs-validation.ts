/**
 * House & Club Engine validation smoke tests (no DB).
 * Run: npx tsx scripts/smoke-houses-clubs-validation.ts
 */
import assert from "node:assert/strict";
import { ensureClubCode, ensureHouseCode } from "../lib/config/codes";
import {
  isColour,
  validateClubCatalogInput,
  validateClubMembershipInput,
  validateHouseCatalogInput,
  validateHouseMembershipInput,
} from "../lib/houses-clubs/validation";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("codes");
assert.equal(ensureHouseCode("Red House", "red"), "RED");
assert.equal(ensureClubCode("Chess Club", ""), "CHESS-CLUB");
console.log("OK");

section("isColour");
assert.equal(isColour("#1A73E8"), true);
assert.equal(isColour("#abc"), true);
assert.equal(isColour("blue"), false);
assert.equal(isColour("#GG0000"), false);
console.log("OK");

section("validateHouseCatalogInput");
const houseBad = validateHouseCatalogInput({
  name: "",
  colour: "red",
});
assert.ok(houseBad.name);
assert.ok(houseBad.colour);
const houseOk = validateHouseCatalogInput({
  name: "Phoenix",
  colour: "#FF5500",
  secondaryColour: "#111111",
});
assert.equal(Object.keys(houseOk).length, 0);
console.log("OK");

section("validateClubCatalogInput");
const clubOk = validateClubCatalogInput({
  name: "Debate",
  description: "Public speaking",
  colour: "#003366",
});
assert.equal(Object.keys(clubOk).length, 0);
console.log("OK");

section("memberships");
const hm = validateHouseMembershipInput({
  houseId: "",
  studentProfileId: "s1",
  // @ts-expect-error intentional
  role: "president",
});
assert.ok(hm.houseId);
assert.ok(hm.role);
const cm = validateClubMembershipInput({
  clubId: "c1",
  studentProfileId: "s1",
  role: "captain",
});
assert.equal(Object.keys(cm).length, 0);
console.log("OK");

console.log("\nAll house/club validation checks passed.");
