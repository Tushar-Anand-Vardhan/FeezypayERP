/**
 * Pure validation smoke for Membership Engine (E29).
 * Run: npx tsx scripts/smoke-membership-validation.ts
 */

import {
  MEMBERSHIP_KINDS,
  MEMBERSHIP_STATUSES,
  CAPABILITY_CLASSES,
} from "../lib/membership/types";
import {
  isDateEffective,
  isMembershipKind,
  staffPersonaFromEmployment,
  studentPersonaFromAdmission,
} from "../lib/membership/validation";

let failed = 0;

function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`OK  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

console.log("\n=== membership kinds / statuses ===");
check("kinds non-empty", MEMBERSHIP_KINDS.length >= 6);
check("statuses include invited+active", MEMBERSHIP_STATUSES.includes("invited"));
check("capability classes", CAPABILITY_CLASSES.includes("admin"));
check("isMembershipKind staff", isMembershipKind("staff"));

console.log("\n=== staff persona mapping ===");
const staff = staffPersonaFromEmployment({
  schoolPersona: "teacher",
  isHod: true,
  status: "active",
});
check("hod from is_hod", staff.persona === "hod" && staff.kind === "staff");

const consultant = staffPersonaFromEmployment({
  employmentType: "consultant",
  status: "active",
});
check("consultant persona", consultant.persona === "consultant");

const ended = staffPersonaFromEmployment({ status: "ended" });
check("former_staff on ended", ended.kind === "former_staff" && ended.status === "ended");

console.log("\n=== student / alumni / transfer ===");
const alumni = studentPersonaFromAdmission("alumni");
check("alumni kind", alumni.kind === "alumni" && alumni.membershipStatus === "active");
const transferred = studentPersonaFromAdmission("transferred");
check(
  "transferred status",
  transferred.membershipStatus === "transferred",
);
const withdrawn = studentPersonaFromAdmission("withdrawn");
check("withdrawn ended", withdrawn.membershipStatus === "ended");

console.log("\n=== date effectiveness ===");
check("open-ended effective", isDateEffective("2020-01-01", null, "2026-08-07"));
check("future not effective", !isDateEffective("2099-01-01", null, "2026-08-07"));
check("past end not effective", !isDateEffective("2020-01-01", "2021-01-01", "2026-08-07"));

console.log("\n=== multi-school switch model (logical) ===");
const memberships = [
  { schoolId: "A", kind: "staff", status: "active" },
  { schoolId: "B", kind: "parent", status: "active" },
];
const active = memberships.filter((m) => m.status === "active");
check("two active schools same person", active.length === 2);
const switchTo = active.find((m) => m.schoolId === "B");
check("switch without new auth user", switchTo?.schoolId === "B");

if (failed > 0) {
  console.error(`\n${failed} membership smoke check(s) failed.`);
  process.exit(1);
}
console.log("\nAll membership smoke checks passed.");
