/**
 * Teacher Portal smoke tests (no DB).
 * Run: npx tsx scripts/smoke-teacher-portal-validation.ts
 */
import assert from "node:assert/strict";
import { isPermissionKey } from "../lib/authz/catalog";
import { isMarkingWindowOpen } from "../lib/assessment/ops-validation";
import {
  matchMarksCsvToRoster,
  parseMarksCsv,
} from "../lib/assessment/marks-csv";
import {
  TEACHER_PORTAL_AREAS,
  TEACHER_PORTAL_NAV,
} from "../lib/teacher-portal/nav";
import { TEACHER_PORTAL_PERMISSIONS } from "../lib/teacher-portal/permissions";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("eleven portal areas");
const requiredAreas = [
  "home",
  "attendance",
  "students",
  "marks",
  "homework",
  "behaviour",
  "events",
  "announcements",
  "resources",
  "department",
  "profile",
];
assert.equal(TEACHER_PORTAL_AREAS.length, 11);
for (const id of requiredAreas) {
  assert.ok(TEACHER_PORTAL_AREAS.includes(id), `missing area ${id}`);
}
assert.equal(new Set(TEACHER_PORTAL_AREAS).size, TEACHER_PORTAL_AREAS.length);
console.log("OK", TEACHER_PORTAL_AREAS.length, "areas");

section("nav hrefs map to /dashboard/teacher");
for (const item of TEACHER_PORTAL_NAV) {
  assert.ok(
    item.href === "/dashboard/teacher" ||
      item.href.startsWith("/dashboard/teacher/"),
    `bad href ${item.href}`,
  );
  assert.ok(item.label.trim().length > 0);
}
console.log("OK");

section("permission key coverage");
for (const key of TEACHER_PORTAL_PERMISSIONS) {
  assert.ok(isPermissionKey(key), `unknown permission ${key}`);
}
for (const item of TEACHER_PORTAL_NAV) {
  const keys = Array.isArray(item.permission)
    ? item.permission
    : [item.permission];
  for (const key of keys) {
    assert.ok(
      (TEACHER_PORTAL_PERMISSIONS as readonly string[]).includes(key),
      `nav key ${key} not in TEACHER_PORTAL_PERMISSIONS`,
    );
    assert.ok(isPermissionKey(key), `nav key ${key} not in catalog`);
  }
}
console.log("OK", TEACHER_PORTAL_PERMISSIONS.length, "keys");

section("route map completeness");
const routeByArea: Record<string, string> = {
  home: "/dashboard/teacher",
  attendance: "/dashboard/teacher/attendance",
  students: "/dashboard/teacher/students",
  marks: "/dashboard/teacher/marks",
  homework: "/dashboard/teacher/homework",
  behaviour: "/dashboard/teacher/behaviour",
  events: "/dashboard/teacher/events",
  announcements: "/dashboard/teacher/announcements",
  resources: "/dashboard/teacher/resources",
  department: "/dashboard/teacher/department",
  profile: "/dashboard/teacher/profile",
};
for (const item of TEACHER_PORTAL_NAV) {
  assert.equal(
    item.href,
    routeByArea[item.id],
    `route mismatch for ${item.id}`,
  );
}
console.log("OK");

section("marking window helper");
assert.equal(
  isMarkingWindowOpen({ markingOpensAt: null, markingClosesAt: null }),
  true,
);
assert.equal(
  isMarkingWindowOpen({
    markingOpensAt: "2099-01-01T00:00:00.000Z",
    markingClosesAt: null,
    now: new Date("2026-08-12T00:00:00.000Z"),
  }),
  false,
);
assert.equal(
  isMarkingWindowOpen({
    markingOpensAt: null,
    markingClosesAt: "2020-01-01T00:00:00.000Z",
    now: new Date("2026-08-12T00:00:00.000Z"),
  }),
  false,
);
console.log("OK");

section("marks CSV parse");
const csv = parseMarksCsv(
  "admission_number,marks,absent\nA1,18,false\nA2,,true\n",
);
assert.equal(csv.rows.length, 2);
assert.equal(csv.rows[0].marksObtained, 18);
assert.equal(csv.rows[1].isAbsent, true);
const matched = matchMarksCsvToRoster(csv.rows, [
  {
    studentProfileId: "p1",
    fullName: "Ada",
    admissionNumber: "A1",
  },
  {
    studentProfileId: "p2",
    fullName: "Bob",
    admissionNumber: "A2",
  },
]);
assert.equal(matched.marks.length, 2);
assert.equal(matched.unmatched.length, 0);
console.log("OK");

console.log("\nAll teacher portal smoke checks passed.");
