import type { createClient } from "@/lib/supabase/server";
import { getChannelAdapter } from "@/lib/notifications/adapters";
import type { NotifyChannel } from "@/lib/notifications/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const MAX_DELIVERY_ATTEMPTS = 6;

/** Exponential backoff seconds: 1m, 5m, 15m, 1h, 6h, 24h */
export function backoffSeconds(attempt: number): number {
  const table = [60, 300, 900, 3600, 21600, 86400];
  return table[Math.min(Math.max(attempt - 1, 0), table.length - 1)]!;
}

/**
 * Claim and process pending notification_outbox rows via channel adapters.
 */
export async function processNotificationOutbox(
  supabase: Supabase,
  options?: { limit?: number },
): Promise<{ processed: number; succeeded: number; failed: number; deadLetter: number }> {
  const limit = options?.limit ?? 40;
  const nowIso = new Date().toISOString();

  const { data: outboxRows } = await supabase
    .from("notification_outbox")
    .select("id, school_id, delivery_request_id, attempts")
    .is("processed_at", null)
    .lte("available_at", nowIso)
    .order("available_at", { ascending: true })
    .limit(limit);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let deadLetter = 0;

  for (const box of outboxRows ?? []) {
    const attemptNumber = (box.attempts ?? 0) + 1;
    await supabase
      .from("notification_outbox")
      .update({ locked_at: nowIso, attempts: attemptNumber })
      .eq("id", box.id)
      .is("processed_at", null);

    const { data: req } = await supabase
      .from("notification_delivery_requests")
      .select(
        "id, school_id, channel, title, body, payload, status, recipient_auth_user_id, recipient_person_id",
      )
      .eq("id", box.delivery_request_id)
      .maybeSingle();

    if (!req) {
      await supabase
        .from("notification_outbox")
        .update({
          processed_at: nowIso,
          last_error: "Delivery request missing",
          locked_at: null,
        })
        .eq("id", box.id);
      processed += 1;
      continue;
    }

    if (
      req.status === "cancelled" ||
      req.status === "read" ||
      req.status === "sent" ||
      req.status === "delivered" ||
      req.status === "dead_letter"
    ) {
      await supabase
        .from("notification_outbox")
        .update({ processed_at: nowIso, locked_at: null })
        .eq("id", box.id);
      processed += 1;
      continue;
    }

    const channel = req.channel as NotifyChannel;
    const adapter = getChannelAdapter(channel);

    await supabase
      .from("notification_delivery_requests")
      .update({ status: "sending", updated_at: nowIso })
      .eq("id", req.id);

    const result = await adapter.send({
      schoolId: req.school_id,
      deliveryRequestId: req.id,
      channel,
      title: req.title,
      body: req.body,
      recipientAuthUserId: req.recipient_auth_user_id,
      recipientPersonId: req.recipient_person_id,
      payload: (req.payload ?? {}) as Record<string, unknown>,
    });

    const attemptStatus =
      result.status === "succeeded"
        ? "succeeded"
        : result.status === "queued_stub" || result.status === "skipped"
          ? "skipped"
          : "failed";

    await supabase.from("notification_delivery_attempts").insert({
      school_id: req.school_id,
      delivery_request_id: req.id,
      attempt_number: attemptNumber,
      channel,
      provider: result.provider,
      status: attemptStatus,
      provider_message_id: result.providerMessageId ?? null,
      error_message: result.errorMessage ?? null,
    });

    if (result.status === "succeeded" || result.status === "queued_stub") {
      const finalStatus =
        result.status === "succeeded" ? "sent" : "sent";
      // queued_stub: mark sent so inbox shows; external retry not needed without keys
      await supabase
        .from("notification_delivery_requests")
        .update({
          status: finalStatus,
          sent_at: nowIso,
          updated_at: nowIso,
          failure_reason:
            result.status === "queued_stub" ? result.errorMessage : null,
        })
        .eq("id", req.id);
      await supabase
        .from("notification_outbox")
        .update({ processed_at: nowIso, locked_at: null, last_error: null })
        .eq("id", box.id);
      succeeded += 1;
    } else if (result.retryable !== false && attemptNumber < MAX_DELIVERY_ATTEMPTS) {
      const availableAt = new Date(
        Date.now() + backoffSeconds(attemptNumber) * 1000,
      ).toISOString();
      await supabase
        .from("notification_delivery_requests")
        .update({
          status: "queued",
          failure_reason: result.errorMessage ?? "Retry scheduled",
          updated_at: nowIso,
        })
        .eq("id", req.id);
      await supabase
        .from("notification_outbox")
        .update({
          available_at: availableAt,
          locked_at: null,
          last_error: result.errorMessage ?? "retry",
        })
        .eq("id", box.id);
      failed += 1;
    } else {
      await supabase
        .from("notification_delivery_requests")
        .update({
          status: "dead_letter",
          failed_at: nowIso,
          failure_reason: result.errorMessage ?? "Max attempts exceeded",
          updated_at: nowIso,
        })
        .eq("id", req.id);
      await supabase
        .from("notification_outbox")
        .update({
          processed_at: nowIso,
          locked_at: null,
          last_error: result.errorMessage ?? "dead_letter",
        })
        .eq("id", box.id);
      deadLetter += 1;
    }

    processed += 1;
  }

  return { processed, succeeded, failed, deadLetter };
}
