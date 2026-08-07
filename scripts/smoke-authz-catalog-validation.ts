/**
 * AuthZ catalog / bundle smoke (no DB).
 * Run: npx tsx scripts/smoke-authz-catalog-validation.ts
 */
import assert from "node:assert/strict";
import { PERMISSION_KEYS, isPermissionKey } from "../lib/authz/catalog";
import {
  SYSTEM_ROLE_BUNDLES,
  SYSTEM_ROLE_CODES,
  canGrantRole,
  hierarchyRank,
} from "../lib/authz/bundles";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("catalog non-empty unique");
assert.ok(PERMISSION_KEYS.length >= 50);
assert.equal(new Set(PERMISSION_KEYS).size, PERMISSION_KEYS.length);
assert.ok(isPermissionKey("attendance.record.create"));
assert.equal(isPermissionKey("not.a.real.key"), false);
console.log("OK", PERMISSION_KEYS.length);

section("every bundle key is in catalog");
for (const code of SYSTEM_ROLE_CODES) {
  for (const key of SYSTEM_ROLE_BUNDLES[code]) {
    assert.ok(isPermissionKey(key), `${code} has unknown key ${key}`);
  }
}
console.log("OK");

section("school_admin is superset of teacher");
const admin = new Set(SYSTEM_ROLE_BUNDLES.school_admin);
for (const key of SYSTEM_ROLE_BUNDLES.teacher) {
  assert.ok(admin.has(key), `admin missing ${key}`);
}
console.log("OK");

section("hierarchy grant rules");
assert.ok(canGrantRole("school_admin", "teacher"));
assert.ok(canGrantRole("principal", "hod"));
assert.equal(canGrantRole("teacher", "principal"), false);
assert.equal(canGrantRole("school_admin", "school_admin"), false);
assert.ok(hierarchyRank("school_admin") < hierarchyRank("teacher"));
console.log("OK");

console.log("\nAll authz catalog smoke checks passed.");
