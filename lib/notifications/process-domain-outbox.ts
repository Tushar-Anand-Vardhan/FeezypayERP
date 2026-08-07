import type { createClient } from "@/lib/supabase/server";
import { orchestrateDomainEvent } from "@/lib/notify-orchestration/orchestrate";
import type { DomainOutboxRow } from "@/lib/notify-orchestration/catalog";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const MAX_DOMAIN_ATTEMPTS = 8;

/**
 * Claim and process pending domain_event_outbox rows.
 */
export async function processDomainEventOutbox(
  supabase: Supabase,
  options?: { limit?: number },
): Promise<{ processed: number; enqueued: number; errors: number }> {
  const limit = options?.limit ?? 25;
  const { data: rows } = await supabase
    .from("domain_event_outbox")
    .select(
      "id, school_id, event_type, aggregate_type, aggregate_id, payload, idempotency_key, attempts",
    )
    .is("processed_at", null)
    .lt("attempts", MAX_DOMAIN_ATTEMPTS)
    .order("occurred_at", { ascending: true })
    .limit(limit);

  let processed = 0;
  let enqueued = 0;
  let errors = 0;

  for (const raw of rows ?? []) {
    const now = new Date().toISOString();
    await supabase
      .from("domain_event_outbox")
      .update({
        locked_at: now,
        attempts: (raw.attempts ?? 0) + 1,
      })
      .eq("id", raw.id)
      .is("processed_at", null);

    const row: DomainOutboxRow = {
      id: raw.id,
      school_id: raw.school_id,
      event_type: raw.event_type,
      aggregate_type: raw.aggregate_type,
      aggregate_id: raw.aggregate_id,
      payload: (raw.payload ?? {}) as Record<string, unknown>,
      idempotency_key: raw.idempotency_key,
    };

    try {
      const result = await orchestrateDomainEvent(supabase, row);
      enqueued += result.enqueued;
      await supabase
        .from("domain_event_outbox")
        .update({
          processed_at: now,
          last_error: result.skipped ?? null,
          locked_at: null,
        })
        .eq("id", raw.id);
      processed += 1;
    } catch (err) {
      errors += 1;
      await supabase
        .from("domain_event_outbox")
        .update({
          last_error: err instanceof Error ? err.message : String(err),
          locked_at: null,
        })
        .eq("id", raw.id);
    }
  }

  return { processed, enqueued, errors };
}
