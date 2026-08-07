/** Notification Engine public surface (E19). */

export type * from "@/lib/notifications/types";
export { enqueueDelivery, processInAppDelivery } from "@/lib/notifications/enqueue";
export {
  listNotificationHistoryAction,
  markNotificationReadAction,
  listNotificationAttemptsAction,
  listNotificationTypesAction,
} from "@/lib/notifications/query-actions";
export { processDomainEventOutbox } from "@/lib/notifications/process-domain-outbox";
export {
  processNotificationOutbox,
  backoffSeconds,
  MAX_DELIVERY_ATTEMPTS,
} from "@/lib/notifications/worker";
export {
  getChannelAdapter,
  listChannelAdapters,
} from "@/lib/notifications/adapters";
export { runNotificationWorkers } from "@/lib/notifications/run-workers";
