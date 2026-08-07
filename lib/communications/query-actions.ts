"use server";

import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listCommMessagesAction(input?: {
  status?: string;
  messageKind?: string;
  academicYearId?: string;
  departmentId?: string;
  classId?: string;
  limit?: number;
  includeArchived?: boolean;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("communication.message.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("comm_messages")
    .select(
      "id, academic_year_id, message_kind, title, body, category_id, priority_id, audience_group_id, department_id, class_id, section_id, audience, status, scheduled_for, published_at, cancelled_at, attachment_media_ids, channels, notification_type_code, created_by, created_at, updated_at",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 100);

  if (!input?.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (input?.status) {
    query = query.eq("status", input.status);
  }
  if (input?.messageKind) {
    query = query.eq("message_kind", input.messageKind);
  }
  if (input?.academicYearId) {
    query = query.eq("academic_year_id", input.academicYearId);
  }
  if (input?.departmentId) {
    query = query.eq("department_id", input.departmentId);
  }
  if (input?.classId) {
    query = query.eq("class_id", input.classId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function getCommMessageAction(messageId: string): Promise<
  | {
      success: true;
      message: Record<string, unknown>;
      receipts: {
        total: number;
        sent: number;
        read: number;
        queued: number;
        failed: number;
        scheduled: number;
      };
      deliveries: Array<Record<string, unknown>>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("communication.message.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: message, error } = await supabase
    .from("comm_messages")
    .select("*")
    .eq("id", messageId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error || !message) {
    return { success: false, error: error?.message ?? "Message not found." };
  }

  const { data: deliveries } = await supabase
    .from("notification_delivery_requests")
    .select(
      "id, channel, status, title, sent_at, read_at, recipient_auth_user_id, recipient_student_profile_id, recipient_parent_profile_id, recipient_employment_id, created_at",
    )
    .eq("school_id", schoolId)
    .eq("message_id", messageId)
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = deliveries ?? [];
  const receipts = {
    total: rows.length,
    sent: rows.filter((r) => r.status === "sent" || r.status === "read")
      .length,
    read: rows.filter((r) => r.status === "read").length,
    queued: rows.filter((r) => r.status === "queued").length,
    failed: rows.filter((r) => r.status === "failed").length,
    scheduled: rows.filter((r) => r.status === "scheduled").length,
  };

  return { success: true, message, receipts, deliveries: rows };
}

export async function listMessageReadReceiptsAction(
  messageId: string,
): Promise<
  | {
      success: true;
      rows: Array<Record<string, unknown>>;
      summary: {
        total: number;
        read: number;
        unread: number;
      };
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("communication.message.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { data, error } = await context.supabase
    .from("notification_delivery_requests")
    .select(
      "id, channel, status, read_at, sent_at, recipient_auth_user_id, recipient_person_id, recipient_student_profile_id, recipient_parent_profile_id, recipient_employment_id, created_at",
    )
    .eq("school_id", context.schoolId)
    .eq("message_id", messageId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    return { success: false, error: error.message };
  }

  const rows = data ?? [];
  const read = rows.filter((r) => r.read_at != null || r.status === "read")
    .length;
  return {
    success: true,
    rows,
    summary: {
      total: rows.length,
      read,
      unread: rows.length - read,
    },
  };
}

export async function listCommMessageAuditAction(
  messageId: string,
): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("communication.message.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { data, error } = await context.supabase
    .from("comm_message_audit_log")
    .select("id, action, actor_id, old_values, new_values, created_at")
    .eq("school_id", context.schoolId)
    .eq("message_id", messageId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}
