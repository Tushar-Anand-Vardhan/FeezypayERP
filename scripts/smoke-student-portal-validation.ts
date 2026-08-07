/**
 * Student Portal smoke tests (no DB).
 * Run: npx tsx scripts/smoke-student-portal-validation.ts
 */
import assert from "node:assert/strict";
import { isPermissionKey } from "../lib/authz/catalog";
import {
  STUDENT_PORTAL_AREAS,
  STUDENT_PORTAL_NAV,
} from "../lib/student-portal/nav";
import {
  STUDENT_PORTAL_PERMISSIONS,
  STUDENT_PORTAL_WRITE_ALLOWLIST,
} from "../lib/student-portal/permissions";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("twelve portal areas");
const requiredAreas = [
  "home",
  "attendance",
  "homework",
  "assessments",
  "report-cards",
  "announcements",
  "events",
  "achievements",
  "behaviour",
  "profile",
  "documents",
  "ai",
];
assert.equal(STUDENT_PORTAL_AREAS.length, 12);
for (const id of requiredAreas) {
  assert.ok(STUDENT_PORTAL_AREAS.includes(id), `missing area ${id}`);
}
assert.equal(new Set(STUDENT_PORTAL_AREAS).size, STUDENT_PORTAL_AREAS.length);
console.log("OK", STUDENT_PORTAL_AREAS.length, "areas");

section("nav hrefs under /dashboard/student");
for (const item of STUDENT_PORTAL_NAV) {
  assert.ok(
    item.href === "/dashboard/student" ||
      item.href.startsWith("/dashboard/student/"),
    `bad href ${item.href}`,
  );
}
console.log("OK");

section("permission catalog coverage");
for (const key of STUDENT_PORTAL_PERMISSIONS) {
  assert.ok(isPermissionKey(key), `unknown ${key}`);
}
for (const item of STUDENT_PORTAL_NAV) {
  const keys = Array.isArray(item.permission)
    ? item.permission
    : [item.permission];
  for (const key of keys) {
    assert.ok(isPermissionKey(key), `nav unknown ${key}`);
  }
}
console.log("OK");

section("write allowlist empty (RO v1)");
assert.equal(STUDENT_PORTAL_WRITE_ALLOWLIST.length, 0);
console.log("OK");

section("route map");
const routeByArea: Record<string, string> = {
  home: "/dashboard/student",
  attendance: "/dashboard/student/attendance",
  homework: "/dashboard/student/homework",
  assessments: "/dashboard/student/assessments",
  "report-cards": "/dashboard/student/report-cards",
  announcements: "/dashboard/student/announcements",
  events: "/dashboard/student/events",
  achievements: "/dashboard/student/achievements",
  behaviour: "/dashboard/student/behaviour",
  profile: "/dashboard/student/profile",
  documents: "/dashboard/student/documents",
  ai: "/dashboard/student/ai",
};
for (const item of STUDENT_PORTAL_NAV) {
  assert.equal(item.href, routeByArea[item.id], `route mismatch ${item.id}`);
}
console.log("OK");

console.log("\nAll student portal smoke checks passed.");
