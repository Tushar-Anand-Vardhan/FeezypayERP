import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type EmitDomainEventInput = {
  schoolId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
  occurredAt?: string | null;
};

/**
 * Insert a domain event outbox row only. Domains must not call providers.
 */
export async function emitDomainEvent(
  supabase: Supabase,
  input: EmitDomainEventInput,
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("domain_event_outbox")
    .insert({
      school_id: input.schoolId,
      event_type: input.eventType,
      aggregate_type: input.aggregateType,
      aggregate_id: input.aggregateId,
      payload: input.payload ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505" && input.idempotencyKey) {
      const { data: existing } = await supabase
        .from("domain_event_outbox")
        .select("id")
        .eq("school_id", input.schoolId)
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      if (existing) {
        return { id: existing.id };
      }
    }
    return { error: error.message };
  }

  if (!data?.id) {
    return { error: "Failed to emit domain event." };
  }
  return { id: data.id };
}
