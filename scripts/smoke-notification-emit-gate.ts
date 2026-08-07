/**
 * Gate: ops modules that should notify must call emitDomainEvent, not enqueueDelivery.
 * Run: npx tsx scripts/smoke-notification-emit-gate.ts
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "lib");
const DOMAINS = [
  "attendance",
  "assessment",
  "behaviour",
  "homework",
  "calendar",
  "report-cards",
  "events",
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith("-actions.ts") || p.endsWith("actions.ts")) acc.push(p);
  }
  return acc;
}

let failed = 0;
const forbidden = /from ["']@\/lib\/notifications\/(enqueue|adapters)/;
const emitOk = /emitDomainEvent/;

for (const domain of DOMAINS) {
  const dir = join(ROOT, domain);
  let files: string[] = [];
  try {
    files = walk(dir);
  } catch {
    continue;
  }
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    if (forbidden.test(src)) {
      failed += 1;
      console.error(`FAIL provider/enqueue import in ${file}`);
    }
  }
}

// Positive: known emit sites
const mustEmit = [
  "lib/attendance/records-actions.ts",
  "lib/assessment/mark-session-actions.ts",
  "lib/behaviour/remarks-actions.ts",
  "lib/homework/homework-actions.ts",
  "lib/calendar/events-actions.ts",
  "lib/report-cards/issue-actions.ts",
];

for (const rel of mustEmit) {
  const src = readFileSync(join(process.cwd(), rel), "utf8");
  if (!emitOk.test(src)) {
    failed += 1;
    console.error(`FAIL missing emitDomainEvent in ${rel}`);
  } else {
    console.log(`OK  emit in ${rel}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} emit-gate check(s) failed.`);
  process.exit(1);
}
console.log("\nAll notification emit-gate checks passed.");
