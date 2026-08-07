/** Communication Engine public surface (E18 config + ops). */

export type * from "@/lib/communications/types";
export type * from "@/lib/communications/ops-types";

export {
  createCommMessageAction,
  updateCommMessageAction,
  publishCommMessageAction,
  cancelCommMessageAction,
  archiveCommMessageAction,
} from "@/lib/communications/message-actions";

export {
  listCommMessagesAction,
  getCommMessageAction,
  listMessageReadReceiptsAction,
  listCommMessageAuditAction,
} from "@/lib/communications/query-actions";

export { resolveMessageAudience } from "@/lib/communications/audience";
