/**
 * Smoke: notification worker retry math + stub adapters.
 * Run: npx tsx scripts/smoke-notification-worker-validation.ts
 */

import {
  backoffSeconds,
  MAX_DELIVERY_ATTEMPTS,
} from "../lib/notifications/worker";
import {
  getChannelAdapter,
  listChannelAdapters,
} from "../lib/notifications/adapters";

let failed = 0;

function check(name: string, cond: boolean) {
  if (cond) console.log(`OK  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

console.log("\n=== backoff ===");
check("attempt 1 = 60s", backoffSeconds(1) === 60);
check("attempt 2 = 300s", backoffSeconds(2) === 300);
check("attempt 6 capped", backoffSeconds(6) === 86400);
check("max attempts >= 5", MAX_DELIVERY_ATTEMPTS >= 5);

console.log("\n=== adapters registry ===");
check("5 adapters", listChannelAdapters().length === 5);

async function adapters() {
  const inApp = await getChannelAdapter("in_app").send({
    schoolId: "s",
    deliveryRequestId: "d",
    channel: "in_app",
    title: "t",
    body: "b",
  });
  check("in_app succeeded", inApp.status === "succeeded");

  const email = await getChannelAdapter("email").send({
    schoolId: "s",
    deliveryRequestId: "d",
    channel: "email",
    title: "t",
    body: "b",
  });
  check(
    "email stub-or-live without crash",
    email.status === "queued_stub" || email.status === "succeeded",
  );

  const wa = await getChannelAdapter("whatsapp").send({
    schoolId: "s",
    deliveryRequestId: "d",
    channel: "whatsapp",
    title: "t",
    body: "b",
  });
  check(
    "whatsapp stub-or-live",
    wa.status === "queued_stub" || wa.status === "succeeded",
  );
}

adapters()
  .then(() => {
    if (failed > 0) {
      console.error(`\n${failed} worker smoke check(s) failed.`);
      process.exit(1);
    }
    console.log("\nAll notification worker smoke checks passed.");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
