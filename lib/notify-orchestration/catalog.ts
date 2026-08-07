import type { NotifyChannel } from "@/lib/notifications/types";

export type DomainOutboxRow = {
  id: string;
  school_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  idempotency_key: string | null;
};

export type OrchestratorHandlerResult = {
  enqueued: number;
  skipped?: string;
};

export type EventNotifyMapping = {
  eventType: string;
  notificationTypeCode: string;
  defaultChannels: NotifyChannel[];
  title: (payload: Record<string, unknown>) => string;
  body: (payload: Record<string, unknown>) => string;
};

export const EVENT_NOTIFY_MAP: EventNotifyMapping[] = [
  {
    eventType: "attendance.record.marked",
    notificationTypeCode: "attendance.absent_alert",
    defaultChannels: ["in_app", "whatsapp"],
    title: () => "Absence alert",
    body: (p) =>
      `Student marked absent on ${String(p.attendanceDate ?? "today")}.`,
  },
  {
    eventType: "assessment.results.published",
    notificationTypeCode: "assessment.results_published",
    defaultChannels: ["in_app"],
    title: () => "Results published",
    body: (p) =>
      `Assessment results are now available${
        p.examLabel ? ` for ${String(p.examLabel)}` : ""
      }.`,
  },
  {
    eventType: "conduct.incident.recorded",
    notificationTypeCode: "conduct.incident",
    defaultChannels: ["in_app", "email"],
    title: (p) => String(p.title ?? "Behaviour note"),
    body: (p) => String(p.body ?? p.description ?? "A behaviour remark was recorded."),
  },
  {
    eventType: "homework.assigned",
    notificationTypeCode: "homework.assigned",
    defaultChannels: ["in_app"],
    title: (p) => String(p.title ?? "New homework"),
    body: (p) =>
      p.dueAt
        ? `Due ${String(p.dueAt)}.`
        : "New homework has been assigned.",
  },
  {
    eventType: "engagement.event.published",
    notificationTypeCode: "engagement.event_published",
    defaultChannels: ["in_app"],
    title: (p) => String(p.title ?? "School event"),
    body: (p) =>
      p.startsAt
        ? `Starts ${String(p.startsAt)}.`
        : "A school event was published.",
  },
  {
    eventType: "document.artifact.issued",
    notificationTypeCode: "document.ready",
    defaultChannels: ["in_app", "email"],
    title: (p) => String(p.title ?? "Document ready"),
    body: () => "A report card or document is ready to view.",
  },
];

export function mappingForEvent(eventType: string): EventNotifyMapping | null {
  return EVENT_NOTIFY_MAP.find((m) => m.eventType === eventType) ?? null;
}
