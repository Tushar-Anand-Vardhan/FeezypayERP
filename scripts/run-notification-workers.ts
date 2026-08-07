/**
 * Run domain + notification outbox workers once.
 * Usage: npx tsx scripts/run-notification-workers.ts
 *
 * Requires a logged-in server context OR use the API route with secret.
 * This script uses the anon/authenticated supabase server client from env —
 * for cron, prefer POST /api/internal/notify-worker with NOTIFY_WORKER_SECRET.
 */

import { createClient } from "@supabase/supabase-js";
import { processDomainEventOutbox } from "../lib/notifications/process-domain-outbox";
import { processNotificationOutbox } from "../lib/notifications/worker";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing Supabase URL / key.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // processDomainEventOutbox expects server client shape — cast via any for script
  const domain = await processDomainEventOutbox(supabase as never, {
    limit: 50,
  });
  const delivery = await processNotificationOutbox(supabase as never, {
    limit: 100,
  });

  console.log(JSON.stringify({ domain, delivery }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
