/** Notification Engine (E19) — delivery pipe types. */

export type NotifyActionResult =
  | { success: true; message: string; id?: string; ids?: string[]; count?: number }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type NotifyChannel = "in_app" | "email" | "whatsapp" | "sms" | "push";

export type DeliveryStatus =
  | "queued"
  | "scheduled"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "read"
  | "cancelled"
  | "dead_letter";


export type RecipientTarget = {
  authUserId?: string | null;
  personId?: string | null;
  studentProfileId?: string | null;
  parentProfileId?: string | null;
  employmentId?: string | null;
};

export type EnqueueDeliveryInput = {
  schoolId: string;
  notificationTypeCode: string;
  messageId?: string | null;
  channel: NotifyChannel;
  recipient: RecipientTarget;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  scheduledFor?: string | null;
  idempotencyKey?: string | null;
};

export const NOTIFY_CHANNELS: NotifyChannel[] = [
  "in_app",
  "email",
  "whatsapp",
  "sms",
  "push",
];

export const DELIVERY_STATUSES: DeliveryStatus[] = [
  "queued",
  "scheduled",
  "sending",
  "sent",
  "delivered",
  "failed",
  "bounced",
  "read",
  "cancelled",
  "dead_letter",
];
