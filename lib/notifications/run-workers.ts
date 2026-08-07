import { createClient } from "@/lib/supabase/server";
import { processDomainEventOutbox } from "@/lib/notifications/process-domain-outbox";
import { processNotificationOutbox } from "@/lib/notifications/worker";

export async function runNotificationWorkers(options?: {
  domainLimit?: number;
  deliveryLimit?: number;
}) {
  const supabase = await createClient();
  const domain = await processDomainEventOutbox(supabase, {
    limit: options?.domainLimit,
  });
  const delivery = await processNotificationOutbox(supabase, {
    limit: options?.deliveryLimit,
  });
  return { domain, delivery };
}
