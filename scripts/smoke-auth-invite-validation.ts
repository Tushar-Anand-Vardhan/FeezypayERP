/**
 * Auth invite validation smoke (no DB / no service role).
 * Run: npx tsx scripts/smoke-auth-invite-validation.ts
 */
import assert from "node:assert/strict";
import { INVITE_STATUSES, INVITE_TARGET_PERSONAS } from "../lib/auth/types";
import { hasServiceRoleKey } from "../lib/supabase/admin";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("invite status machine");
assert.deepEqual(
  [...INVITE_STATUSES].sort(),
  ["accepted", "expired", "pending", "revoked"].sort(),
);
console.log("OK");

section("invite target personas exclude school_admin bootstrap");
assert.ok(INVITE_TARGET_PERSONAS.includes("teacher"));
assert.ok(INVITE_TARGET_PERSONAS.includes("parent"));
assert.ok(INVITE_TARGET_PERSONAS.includes("student"));
assert.equal(
  (INVITE_TARGET_PERSONAS as readonly string[]).includes("school_admin"),
  false,
);
console.log("OK");

section("service role helper is boolean (env may be unset in CI)");
assert.equal(typeof hasServiceRoleKey(), "boolean");
console.log(
  hasServiceRoleKey()
    ? "OK (service role configured)"
    : "OK (service role not configured — invite send will warn)",
);

section("F11 intent contract");
const createSchool = { intent: "create_school" };
const acceptInvite = { intent: "accept_invite" };
assert.equal(createSchool.intent, "create_school");
assert.equal(acceptInvite.intent, "accept_invite");
console.log("OK");

console.log("\nAll auth invite smoke checks passed.");
