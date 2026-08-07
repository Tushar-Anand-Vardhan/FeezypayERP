"use server";

import { revalidatePath } from "next/cache";
import { resolveMessageAudience } from "@/lib/communications/audience";
import type {
  CommOpsActionResult,
  CreateMessageInput,
  UpdateMessageInput,
} from "@/lib/communications/ops-types";
import { KIND_TO_NOTIFY_TYPE } from "@/lib/communications/ops-types";
import {
  validateCreateMessageInput,
  validateUpdateMessageInput,
} from "@/lib/communications/ops-validation";
import { getActorId } from "@/lib/communications/server-helpers";
import { enqueueDelivery } from "@/lib/notifications/enqueue";
import type { NotifyChannel } from "@/lib/notifications/types";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/communications");
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard/teacher");
}

async function writeCommAudit(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  input: {
    schoolId: string;
    action: string;
    actorId: string | null;
    messageId: string;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  },
) {
  await supabase.from("comm_message_audit_log").insert({
    school_id: input.schoolId,
    action: input.action,
    actor_id: input.actorId,
    message_id: input.messageId,
    old_values: input.oldValues ?? null,
    new_values: input.newValues ?? null,
  });
}

async function fanOutDeliveries(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  schoolId: string,
  message: {
    id: string;
    title: string;
    body: string;
    message_kind: string;
    notification_type_code: string;
    channels: string[];
    audience: Record<string, unknown>;
    class_id: string | null;
    section_id: string | null;
    department_id: string | null;
    academic_year_id: string | null;
    scheduled_for: string | null;
  },
): Promise<number> {
  const recipients = await resolveMessageAudience(supabase, schoolId, {
    audience: (message.audience ?? {}) as never,
    messageKind: message.message_kind,
    classId: message.class_id,
    sectionId: message.section_id,
    departmentId: message.department_id,
    academicYearId: message.academic_year_id,
  });

  const channels = (message.channels?.length
    ? message.channels
    : ["in_app"]) as NotifyChannel[];

  let count = 0;
  for (const recipient of recipients) {
    // Enrich auth user when possible
    let authUserId: string | null = null;
    if (recipient.employmentId) {
      const { data: emp } = await supabase
        .from("teacher_employments")
        .select("teacher_profile_id")
        .eq("id", recipient.employmentId)
        .maybeSingle();
      if (emp?.teacher_profile_id) {
        const { data: tp } = await supabase
          .from("teacher_profiles")
          .select("person_id")
          .eq("id", emp.teacher_profile_id)
          .maybeSingle();
        if (tp?.person_id) {
          recipient.personId = tp.person_id;
          const { data: person } = await supabase
            .from("persons")
            .select("auth_user_id")
            .eq("id", tp.person_id)
            .maybeSingle();
          authUserId = person?.auth_user_id ?? null;
        }
      }
    } else if (recipient.studentProfileId) {
      const { data: sp } = await supabase
        .from("student_profiles")
        .select("person_id")
        .eq("id", recipient.studentProfileId)
        .maybeSingle();
      if (sp?.person_id) {
        recipient.personId = sp.person_id;
        const { data: person } = await supabase
          .from("persons")
          .select("auth_user_id")
          .eq("id", sp.person_id)
          .maybeSingle();
        authUserId = person?.auth_user_id ?? null;
      }
    } else if (recipient.parentProfileId) {
      const { data: pp } = await supabase
        .from("parent_profiles")
        .select("person_id")
        .eq("id", recipient.parentProfileId)
        .maybeSingle();
      if (pp?.person_id) {
        recipient.personId = pp.person_id;
        const { data: person } = await supabase
          .from("persons")
          .select("auth_user_id")
          .eq("id", pp.person_id)
          .maybeSingle();
        authUserId = person?.auth_user_id ?? null;
      }
    }

    for (const channel of channels) {
      const result = await enqueueDelivery(supabase, {
        schoolId,
        notificationTypeCode: message.notification_type_code,
        messageId: message.id,
        channel,
        recipient: {
          ...recipient,
          authUserId,
        },
        title: message.title,
        body: message.body,
        payload: {
          message_kind: message.message_kind,
          message_id: message.id,
        },
        scheduledFor: message.scheduled_for,
        idempotencyKey: `${message.id}:${recipient.key}:${channel}`,
      });
      if ("id" in result) count += 1;
    }
  }
  return count;
}

export async function createCommMessageAction(
  input: CreateMessageInput,
): Promise<CommOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("communication.message.publish");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateCreateMessageInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const scheduledFor = input.scheduledFor ?? null;
  const publishNow = Boolean(input.publishNow) && !scheduledFor;
  const isScheduled =
    scheduledFor != null && new Date(scheduledFor).getTime() > Date.now();

  let status: string = "draft";
  if (publishNow) status = "published";
  else if (isScheduled) status = "scheduled";

  const notifyType =
    KIND_TO_NOTIFY_TYPE[input.messageKind] ?? "communication.announcement";

  const { data: message, error } = await supabase
    .from("comm_messages")
    .insert({
      school_id: schoolId,
      academic_year_id: input.academicYearId ?? null,
      message_kind: input.messageKind,
      title: input.title.trim(),
      body: input.body.trim(),
      category_id: input.categoryId ?? null,
      priority_id: input.priorityId ?? null,
      audience_group_id: input.audienceGroupId ?? null,
      template_id: input.templateId ?? null,
      template_version_id: input.templateVersionId ?? null,
      department_id: input.departmentId ?? null,
      class_id: input.classId ?? null,
      section_id: input.sectionId ?? null,
      department_announcement_id: input.departmentAnnouncementId ?? null,
      audience: input.audience ?? {},
      status,
      scheduled_for: scheduledFor,
      published_at: publishNow ? new Date().toISOString() : null,
      published_by: publishNow ? actorId : null,
      attachment_media_ids: input.attachmentMediaIds ?? [],
      channels: input.channels ?? ["in_app"],
      notification_type_code: notifyType,
      created_by: actorId,
      created_by_employment_id: input.employmentId ?? null,
    })
    .select("*")
    .maybeSingle();

  if (error || !message) {
    return {
      success: false,
      error: error?.message ?? "Failed to create message.",
    };
  }

  await writeCommAudit(supabase, {
    schoolId,
    action: "message.created",
    actorId,
    messageId: message.id,
    newValues: { status, message_kind: input.messageKind },
  });

  let deliveryCount = 0;
  if (status === "published" || status === "scheduled") {
    deliveryCount = await fanOutDeliveries(supabase, schoolId, message);
    await writeCommAudit(supabase, {
      schoolId,
      action:
        status === "published" ? "message.published" : "message.scheduled",
      actorId,
      messageId: message.id,
      newValues: { deliveryCount },
    });
  }

  revalidate();
  return {
    success: true,
    message:
      status === "published"
        ? `Message published (${deliveryCount} deliveries).`
        : status === "scheduled"
          ? `Message scheduled (${deliveryCount} deliveries queued).`
          : "Draft message saved.",
    id: message.id,
    deliveryCount,
  };
}

export async function updateCommMessageAction(
  input: UpdateMessageInput,
): Promise<CommOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("communication.message.publish");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateUpdateMessageInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const { data: existing } = await supabase
    .from("comm_messages")
    .select("id, status")
    .eq("id", input.id)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!existing) {
    return { success: false, error: "Message not found." };
  }
  if (existing.status === "published") {
    return {
      success: false,
      error: "Published messages cannot be edited — create a new message.",
    };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.body !== undefined) patch.body = input.body.trim();
  if (input.audience !== undefined) patch.audience = input.audience;
  if (input.channels !== undefined) patch.channels = input.channels;
  if (input.attachmentMediaIds !== undefined) {
    patch.attachment_media_ids = input.attachmentMediaIds;
  }
  if (input.scheduledFor !== undefined) {
    patch.scheduled_for = input.scheduledFor;
    if (
      input.scheduledFor &&
      new Date(input.scheduledFor).getTime() > Date.now()
    ) {
      patch.status = "scheduled";
    }
  }
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.priorityId !== undefined) patch.priority_id = input.priorityId;

  const { error } = await supabase
    .from("comm_messages")
    .update(patch)
    .eq("id", input.id);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeCommAudit(supabase, {
    schoolId,
    action: "message.updated",
    actorId,
    messageId: input.id,
    newValues: patch,
  });

  revalidate();
  return { success: true, message: "Message updated.", id: input.id };
}

export async function publishCommMessageAction(
  messageId: string,
): Promise<CommOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("communication.message.publish");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const { data: message } = await supabase
    .from("comm_messages")
    .select("*")
    .eq("id", messageId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!message) {
    return { success: false, error: "Message not found." };
  }
  if (message.status === "published") {
    return { success: true, message: "Already published.", id: messageId };
  }
  if (message.status === "cancelled") {
    return { success: false, error: "Cancelled messages cannot be published." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("comm_messages")
    .update({
      status: "published",
      published_at: now,
      published_by: actorId,
      scheduled_for: null,
      updated_at: now,
    })
    .eq("id", messageId);

  if (error) {
    return { success: false, error: error.message };
  }

  const deliveryCount = await fanOutDeliveries(supabase, schoolId, {
    ...message,
    status: "published",
    scheduled_for: null,
  });

  await writeCommAudit(supabase, {
    schoolId,
    action: "message.published",
    actorId,
    messageId,
    newValues: { deliveryCount },
  });

  revalidate();
  return {
    success: true,
    message: `Message published (${deliveryCount} deliveries).`,
    id: messageId,
    deliveryCount,
  };
}

export async function cancelCommMessageAction(
  messageId: string,
): Promise<CommOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("communication.message.publish");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("comm_messages")
    .select("id, status")
    .eq("id", messageId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!existing) {
    return { success: false, error: "Message not found." };
  }

  const { error } = await supabase
    .from("comm_messages")
    .update({
      status: "cancelled",
      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", messageId);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase
    .from("notification_delivery_requests")
    .update({ status: "cancelled", updated_at: now })
    .eq("message_id", messageId)
    .in("status", ["queued", "scheduled"]);

  await writeCommAudit(supabase, {
    schoolId,
    action: "message.cancelled",
    actorId,
    messageId,
  });

  revalidate();
  return { success: true, message: "Message cancelled.", id: messageId };
}

export async function archiveCommMessageAction(
  messageId: string,
): Promise<CommOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("communication.message.publish");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("comm_messages")
    .update({
      archived_at: now,
      status: "archived",
      updated_at: now,
    })
    .eq("id", messageId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeCommAudit(supabase, {
    schoolId,
    action: "message.archived",
    actorId,
    messageId,
  });

  revalidate();
  return { success: true, message: "Message archived.", id: messageId };
}
