/**
 * Principal portal smoke (no DB).
 * Run: npx tsx scripts/smoke-principal-portal-validation.ts
 */
import assert from "node:assert/strict";
import { isPermissionKey } from "../lib/authz/catalog";
import {
  PRINCIPAL_PORTAL_AREAS,
  PRINCIPAL_PORTAL_NAV,
  PRINCIPAL_PORTAL_PERMISSIONS,
} from "../lib/principal-portal/nav";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("principal portal areas");
assert.equal(PRINCIPAL_PORTAL_AREAS.length, 4);
for (const id of ["home", "teachers", "students", "promote"]) {
  assert.ok(PRINCIPAL_PORTAL_AREAS.includes(id), `missing ${id}`);
}
console.log("OK", PRINCIPAL_PORTAL_AREAS.length);

section("nav hrefs");
for (const item of PRINCIPAL_PORTAL_NAV) {
  assert.ok(item.href.startsWith("/dashboard/principal"));
  const keys = Array.isArray(item.permission)
    ? item.permission
    : [item.permission];
  for (const key of keys) {
    assert.ok(isPermissionKey(key));
    assert.ok(
      (PRINCIPAL_PORTAL_PERMISSIONS as readonly string[]).includes(key),
    );
  }
}
console.log("OK");

console.log("\nAll principal portal smoke checks passed.");
