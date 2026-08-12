/**
 * Wave 6 career / parent / platform smoke (no DB).
 * Run: npx tsx scripts/smoke-wave6-identity-validation.ts
 */
import assert from "node:assert/strict";
import { PERMISSION_KEYS, isPermissionKey } from "../lib/authz/catalog";
import { SYSTEM_ROLE_BUNDLES } from "../lib/authz/bundles";
import { PARENT_PORTAL_NAV } from "../lib/parent-portal/nav";
import { TEACHER_PORTAL_NAV } from "../lib/teacher-portal/nav";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("permissions");
assert.ok(isPermissionKey("workforce.employment.self_end"));
assert.ok(isPermissionKey("platform.tenant.read"));
assert.ok(isPermissionKey("platform.impersonate"));
assert.ok(
  SYSTEM_ROLE_BUNDLES.teacher.includes("workforce.employment.self_end"),
);
assert.ok(SYSTEM_ROLE_BUNDLES.hod.includes("workforce.employment.self_end"));
assert.ok(PERMISSION_KEYS.includes("platform.tenant.read"));
console.log("OK");

section("parent portal nav");
assert.ok(PARENT_PORTAL_NAV.some((n) => n.id === "home"));
assert.ok(PARENT_PORTAL_NAV.every((n) => n.href.startsWith("/dashboard/parent")));
console.log("OK");

section("teacher profile nav");
assert.ok(TEACHER_PORTAL_NAV.some((n) => n.href === "/dashboard/teacher/profile"));
console.log("OK");

console.log("\nAll Wave 6 identity smoke checks passed.");
