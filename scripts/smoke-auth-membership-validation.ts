/**
 * Auth membership / persona validation smoke (no DB).
 * Run: npx tsx scripts/smoke-auth-membership-validation.ts
 */
import assert from "node:assert/strict";
import {
  isLoginCapableMembership,
  pickDefaultMembership,
} from "../lib/auth/membership";
import type { AuthMembership } from "../lib/auth/types";
import { AUTH_PERSONAS, INVITE_TARGET_PERSONAS } from "../lib/auth/types";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("persona catalogs");
assert.ok(AUTH_PERSONAS.includes("school_admin"));
assert.ok(AUTH_PERSONAS.includes("alumni"));
assert.ok(INVITE_TARGET_PERSONAS.includes("teacher"));
assert.ok(!INVITE_TARGET_PERSONAS.includes("school_admin" as never));
console.log("OK");

section("pickDefaultMembership prefers school_admin");
const memberships: AuthMembership[] = [
  {
    schoolId: "s1",
    persona: "teacher",
    source: "employment",
    sourceId: "e1",
    status: "active",
  },
  {
    schoolId: "s1",
    persona: "school_admin",
    source: "profile",
    sourceId: "p1",
    status: "active",
  },
  {
    schoolId: "s2",
    persona: "parent",
    source: "parent_link",
    sourceId: "l1",
    status: "active",
  },
];
const def = pickDefaultMembership(memberships);
assert.equal(def?.persona, "school_admin");
assert.equal(def?.schoolId, "s1");
console.log("OK");

section("teacher+parent multi-school capable");
assert.ok(
  isLoginCapableMembership({
    schoolId: "s2",
    persona: "parent",
    source: "parent_link",
    sourceId: "l1",
    status: "active",
  }),
);
assert.ok(
  isLoginCapableMembership({
    schoolId: "s1",
    persona: "teacher",
    source: "employment",
    sourceId: "e1",
    status: "invited",
  }),
);
assert.equal(
  isLoginCapableMembership({
    schoolId: "s1",
    persona: "teacher",
    source: "employment",
    sourceId: "e2",
    status: "ended",
  }),
  false,
);
assert.ok(
  isLoginCapableMembership({
    schoolId: "s1",
    persona: "alumni",
    source: "admission",
    sourceId: "a1",
    status: "alumni",
  }),
);
console.log("OK");

section("empty memberships");
assert.equal(pickDefaultMembership([]), null);
console.log("OK");

console.log("\nAll auth membership smoke checks passed.");
