/**
 * Fail if write-ish action files still call bare getAuthenticatedSchoolContext().
 * Run: npx tsx scripts/smoke-authz-action-gate.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith("-actions.ts") || name === "actions.ts") out.push(p);
  }
  return out;
}

const files = walk("lib").concat(walk("app"));
const bare: string[] = [];
for (const f of files) {
  const text = readFileSync(f, "utf8");
  if (/getAuthenticatedSchoolContext\(\s*\)/.test(text)) {
    bare.push(f);
  }
}

assert.equal(
  bare.length,
  0,
  `Bare getAuthenticatedSchoolContext() still in:\n${bare.join("\n")}`,
);

const withPerm = files.filter((f) =>
  /getAuthenticatedSchoolContext\(\s*["']/.test(readFileSync(f, "utf8")),
);
assert.ok(withPerm.length > 50, "expected many permission-gated call sites");

console.log(`OK: ${withPerm.length} gated action files; 0 bare calls.`);
