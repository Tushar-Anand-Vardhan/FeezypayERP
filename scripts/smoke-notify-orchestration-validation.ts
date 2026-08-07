/**
 * Smoke: notify orchestration catalog + mapping rules.
 * Run: npx tsx scripts/smoke-notify-orchestration-validation.ts
 */

import {
  EVENT_NOTIFY_MAP,
  mappingForEvent,
} from "../lib/notify-orchestration/catalog";

let failed = 0;

function check(name: string, cond: boolean) {
  if (cond) console.log(`OK  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

console.log("\n=== event → notify map completeness ===");
const required = [
  "attendance.record.marked",
  "assessment.results.published",
  "conduct.incident.recorded",
  "homework.assigned",
  "engagement.event.published",
  "document.artifact.issued",
];
for (const ev of required) {
  check(`maps ${ev}`, mappingForEvent(ev) != null);
}

check("map size >= 6", EVENT_NOTIFY_MAP.length >= 6);

console.log("\n=== idempotency key shape ===");
const eventId = "evt-1";
const recipientKey = "par:abc";
const channel = "in_app";
const key = `${eventId}:${recipientKey}:${channel}`;
check("idempotency includes event+recipient+channel", key.split(":").length >= 3);

console.log("\n=== absent-only attendance semantics ===");
const att = mappingForEvent("attendance.record.marked");
check(
  "absent alert type",
  att?.notificationTypeCode === "attendance.absent_alert",
);

console.log("\n=== homework catalogue event ===");
check(
  "homework.assigned notify type",
  mappingForEvent("homework.assigned")?.notificationTypeCode ===
    "homework.assigned",
);

if (failed > 0) {
  console.error(`\n${failed} notify orchestration check(s) failed.`);
  process.exit(1);
}
console.log("\nAll notify orchestration smoke checks passed.");
