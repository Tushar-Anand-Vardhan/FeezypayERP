/**
 * Dashboard grouped nav smoke (no DB).
 * Run: npx tsx scripts/smoke-dashboard-nav-validation.ts
 */
import assert from "node:assert/strict";
import type { AuthzBootstrap } from "../lib/authz/bootstrap-shared";
import {
  DASHBOARD_NAV_GROUPS,
  activeDashboardNavGroupId,
  isDashboardNavActive,
  visibleDashboardNavGroups,
} from "../lib/dashboard/nav";
import { RESET_ONBOARDING_CONFIRMATION } from "../lib/onboarding/reset-actions";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("catalog covers the previous top-nav labels");
const labels = DASHBOARD_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => item.label),
);
for (const expected of [
  "Overview",
  "Principal",
  "Teacher",
  "Student",
  "Parent",
  "Platform",
  "Configuration",
  "Assessments",
  "Report cards",
  "Calendar",
  "Houses & clubs",
  "Subjects",
  "Grading scales",
  "Departments",
  "Timetable",
  "Notifications",
  "Students",
  "Attendance",
  "Settings",
]) {
  assert.ok(labels.includes(expected), `missing ${expected}`);
}
const ids = DASHBOARD_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => item.id),
);
assert.equal(new Set(ids).size, ids.length);
console.log("OK");

section("isDashboardNavActive does not treat /dashboard as a prefix");
assert.equal(isDashboardNavActive("/dashboard", "/dashboard"), true);
assert.equal(isDashboardNavActive("/dashboard", "/dashboard/teacher"), false);
assert.equal(
  isDashboardNavActive("/dashboard/principal", "/dashboard/principal/teachers"),
  true,
);
assert.equal(isDashboardNavActive("#", "/dashboard"), false);
assert.equal(activeDashboardNavGroupId("/dashboard/subjects"), "configuration");
assert.equal(activeDashboardNavGroupId("/dashboard/teacher/marks"), "portals");
assert.equal(activeDashboardNavGroupId("/dashboard/settings"), "system");
const settings = DASHBOARD_NAV_GROUPS.flatMap((group) => group.items).find(
  (item) => item.id === "settings",
);
assert.equal(settings?.href, "/dashboard/settings");
assert.equal(settings?.lockedUntilOnboarding, undefined);
assert.ok(
  Array.isArray(settings?.permission)
    ? settings.permission.includes("onboarding.wizard.edit")
    : settings?.permission === "onboarding.wizard.edit" ||
        settings?.permission === "tenant.school.edit",
);
assert.equal(RESET_ONBOARDING_CONFIRMATION, "RESET");
console.log("OK");

section("RBAC hides groups the actor cannot use");
const teacher: AuthzBootstrap = {
  schoolId: "s1",
  persona: "teacher",
  isSchoolAdmin: false,
  permissions: [
    "tenant.school.read",
    "workforce.workspace.read",
    "attendance.record.read",
    "communication.message.read",
  ],
};
const visible = visibleDashboardNavGroups(teacher);
assert.deepEqual(
  visible.map((group) => group.id),
  ["home", "portals", "operations"],
);
assert.deepEqual(
  visible.find((group) => group.id === "portals")?.items.map((item) => item.id),
  ["teacher"],
);
assert.equal(visibleDashboardNavGroups(null).length, 0);
console.log("OK");

console.log("\nAll dashboard nav checks passed.");
