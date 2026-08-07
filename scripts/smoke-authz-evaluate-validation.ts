/**
 * AuthZ evaluate / ABAC smoke (no DB).
 * Run: npx tsx scripts/smoke-authz-evaluate-validation.ts
 */
import assert from "node:assert/strict";
import { SYSTEM_ROLE_BUNDLES } from "../lib/authz/bundles";
import { hasPermission } from "../lib/authz/evaluate";
import type { AuthzActor } from "../lib/authz/types";
import type { PermissionKey } from "../lib/authz/catalog";

function actor(partial: Partial<AuthzActor> & Pick<AuthzActor, "permissionKeys">): AuthzActor {
  return {
    authUserId: "u1",
    personId: "p1",
    schoolId: "s1",
    activePersona: "teacher",
    systemRoles: ["teacher"],
    departmentIds: [],
    subjectIds: [],
    linkedStudentProfileIds: [],
    employmentStatus: "active",
    isSchoolAdmin: false,
    ...partial,
  };
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("admin allows config edit");
const admin = actor({
  isSchoolAdmin: true,
  activePersona: "school_admin",
  systemRoles: ["school_admin"],
  permissionKeys: new Set(SYSTEM_ROLE_BUNDLES.school_admin),
});
assert.equal(hasPermission(admin, "config.catalog.edit").allow, true);
console.log("OK");

section("teacher denies fee create");
const teacher = actor({
  permissionKeys: new Set(SYSTEM_ROLE_BUNDLES.teacher),
});
assert.equal(hasPermission(teacher, "fee.invoice.create").allow, false);
console.log("OK");

section("teacher subject ABAC");
const scoped = actor({
  permissionKeys: new Set(SYSTEM_ROLE_BUNDLES.teacher),
  subjectIds: ["sub-a"],
});
assert.equal(
  hasPermission(scoped, "assessment.results.enter", { subjectId: "sub-b" })
    .allow,
  false,
);
assert.equal(
  hasPermission(scoped, "assessment.results.enter", { subjectId: "sub-a" })
    .allow,
  true,
);
console.log("OK");

section("parent linked child");
const parent = actor({
  activePersona: "parent",
  systemRoles: ["parent"],
  permissionKeys: new Set(SYSTEM_ROLE_BUNDLES.parent),
  linkedStudentProfileIds: ["stu-1"],
});
assert.equal(
  hasPermission(parent, "attendance.record.read", {
    studentProfileId: "stu-2",
  }).allow,
  false,
);
assert.equal(
  hasPermission(parent, "attendance.record.read", {
    studentProfileId: "stu-1",
  }).allow,
  true,
);
console.log("OK");

section("hod department boundary");
const hod = actor({
  activePersona: "hod",
  systemRoles: ["hod"],
  permissionKeys: new Set(SYSTEM_ROLE_BUNDLES.hod),
  departmentIds: ["d1"],
});
assert.equal(
  hasPermission(hod, "workforce.department.edit", { departmentId: "d2" }).allow,
  false,
);
assert.equal(
  hasPermission(hod, "workforce.department.edit", { departmentId: "d1" }).allow,
  true,
);
console.log("OK");

section("missing membership key");
const empty = actor({ permissionKeys: new Set<PermissionKey>() });
assert.equal(hasPermission(empty, "tenant.school.read").allow, false);
console.log("OK");

console.log("\nAll authz evaluate smoke checks passed.");
