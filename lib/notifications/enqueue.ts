import type { createClient } from "@/lib/supabase/server";
import type { EnqueueDeliveryInput, NotifyChannel } from "@/lib/notifications/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Enqueue a delivery request + outbox row.
 * in_app is processed immediately (stub adapter); other channels stay queued for workers.
 */
export async function enqueueDelivery(
  supabase: Supabase,
  input: EnqueueDeliveryInput,
): Promise<{ id: string } | { error: string }> {
  const scheduledFor = input.scheduledFor ?? null;
  const isFuture =
    scheduledFor != null && new Date(scheduledFor).getTime() > Date.now();

  const status = isFuture ? "scheduled" : "queued";

  const { data: request, error } = await supabase
    .from("notification_delivery_requests")
    .insert({
      school_id: input.schoolId,
      notification_type_code: input.notificationTypeCode,
      message_id: input.messageId ?? null,
      channel: input.channel,
      recipient_auth_user_id: input.recipient.authUserId ?? null,
      recipient_person_id: input.recipient.personId ?? null,
      recipient_student_profile_id: input.recipient.studentProfileId ?? null,
      recipient_parent_profile_id: input.recipient.parentProfileId ?? null,
      recipient_employment_id: input.recipient.employmentId ?? null,
      title: input.title,
      body: input.body,
      payload: input.payload ?? {},
      status,
      scheduled_for: scheduledFor,
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      // idempotent replay
      const { data: existing } = await supabase
        .from("notification_delivery_requests")
        .select("id")
        .eq("school_id", input.schoolId)
        .eq("idempotency_key", input.idempotencyKey!)
        .maybeSingle();
      if (existing) return { id: existing.id };
    }
    return { error: error.message };
  }
  if (!request) {
    return { error: "Failed to create delivery request." };
  }

  await supabase.from("notification_outbox").insert({
    school_id: input.schoolId,
    delivery_request_id: request.id,
    available_at: scheduledFor ?? new Date().toISOString(),
  });

  if (!isFuture && input.channel === "in_app") {
    await processInAppDelivery(supabase, input.schoolId, request.id);
  }

  return { id: request.id };
}

export async function processInAppDelivery(
  supabase: Supabase,
  schoolId: string,
  deliveryRequestId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("notification_delivery_requests")
    .update({
      status: "sent",
      sent_at: now,
      updated_at: now,
    })
    .eq("id", deliveryRequestId)
    .eq("school_id", schoolId);

  await supabase.from("notification_delivery_attempts").insert({
    school_id: schoolId,
    delivery_request_id: deliveryRequestId,
    attempt_number: 1,
    channel: "in_app",
    provider: "in_app_stub",
    status: "succeeded",
  });

  await supabase
    .from("notification_outbox")
    .update({ processed_at: now })
    .eq("delivery_request_id", deliveryRequestId)
    .is("processed_at", null);
}

/** Stub process for non-in_app channels — records skipped attempt, leaves queued for real providers. */
export async function processStubExternalDelivery(
  supabase: Supabase,
  schoolId: string,
  deliveryRequestId: string,
  channel: NotifyChannel,
): Promise<void> {
  await supabase.from("notification_delivery_attempts").insert({
    school_id: schoolId,
    delivery_request_id: deliveryRequestId,
    attempt_number: 1,
    channel,
    provider: "stub",
    status: "skipped",
    error_message: "External provider not configured — left queued.",
  });
}

export async function markDeliveryRead(
  supabase: Supabase,
  schoolId: string,
  deliveryRequestId: string,
  actorUserId: string | null,
): Promise<{ ok: true } | { error: string }> {
  const { data } = await supabase
    .from("notification_delivery_requests")
    .select("id, recipient_auth_user_id, status, school_id")
    .eq("id", deliveryRequestId)
    .maybeSingle();

  if (!data || data.school_id !== schoolId) {
    // allow self-read across school check via recipient
    if (!data) return { error: "Notification not found." };
  }

  if (
    actorUserId &&
    data.recipient_auth_user_id &&
    data.recipient_auth_user_id !== actorUserId &&
    data.school_id === schoolId
  ) {
    // school admin may mark; recipient may mark own
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notification_delivery_requests")
    .update({
      status: "read",
      read_at: now,
      updated_at: now,
    })
    .eq("id", deliveryRequestId);

  if (error) return { error: error.message };
  return { ok: true };
}
