"use server";

import { revalidatePath } from "next/cache";
import { markDeliveryRead } from "@/lib/notifications/enqueue";
import type { NotifyActionResult } from "@/lib/notifications/types";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import { createClient } from "@/lib/supabase/server";

function revalidate() {
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard/communications");
}

async function getActorId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function listNotificationHistoryAction(input: {
  limit?: number;
  status?: string;
  channel?: string;
  messageId?: string;
  studentProfileId?: string;
  /** When true, only notifications for the current auth user */
  mineOnly?: boolean;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("communication.message.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId();

  let query = supabase
    .from("notification_delivery_requests")
    .select(
      "id, notification_type_code, message_id, channel, title, body, status, scheduled_for, sent_at, read_at, recipient_student_profile_id, recipient_parent_profile_id, recipient_employment_id, recipient_auth_user_id, created_at",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);

  if (input.mineOnly && actorId) {
    query = query.eq("recipient_auth_user_id", actorId);
  }
  if (input.status) {
    query = query.eq("status", input.status);
  }
  if (input.channel) {
    query = query.eq("channel", input.channel);
  }
  if (input.messageId) {
    query = query.eq("message_id", input.messageId);
  }
  if (input.studentProfileId) {
    query = query.eq("recipient_student_profile_id", input.studentProfileId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function markNotificationReadAction(
  deliveryRequestId: string,
): Promise<NotifyActionResult> {
  const context = await getAuthenticatedSchoolContext("communication.message.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const actorId = await getActorId();
  const result = await markDeliveryRead(
    context.supabase,
    context.schoolId,
    deliveryRequestId,
    actorId,
  );
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  revalidate();
  return { success: true, message: "Marked as read.", id: deliveryRequestId };
}

export async function listNotificationAttemptsAction(
  deliveryRequestId: string,
): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("communication.message.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { data, error } = await context.supabase
    .from("notification_delivery_attempts")
    .select(
      "id, attempt_number, channel, provider, status, provider_message_id, error_message, created_at",
    )
    .eq("school_id", context.schoolId)
    .eq("delivery_request_id", deliveryRequestId)
    .order("attempt_number", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function listNotificationTypesAction(): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("communication.message.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { data, error } = await context.supabase
    .from("notification_types")
    .select("code, name, description, default_channels, default_priority, is_active")
    .eq("is_active", true)
    .order("code");

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}
