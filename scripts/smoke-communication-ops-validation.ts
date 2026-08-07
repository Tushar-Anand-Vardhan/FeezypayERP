/**
 * Pure validation smoke for Communication Operations (E18) + Notification types (E19).
 * Run: npx tsx scripts/smoke-communication-ops-validation.ts
 */

import {
  KIND_TO_NOTIFY_TYPE,
  MESSAGE_KINDS,
  MESSAGE_STATUSES,
} from "../lib/communications/ops-types";
import {
  validateCreateMessageInput,
  validateUpdateMessageInput,
} from "../lib/communications/ops-validation";
import {
  DELIVERY_STATUSES,
  NOTIFY_CHANNELS,
} from "../lib/notifications/types";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("=== message kinds ===");
for (const k of [
  "announcement",
  "circular",
  "department",
  "teacher",
  "class",
  "parent_notice",
  "student_notice",
] as const) {
  assert(MESSAGE_KINDS.includes(k), k);
  assert(KIND_TO_NOTIFY_TYPE[k]?.startsWith("communication."), `type ${k}`);
}
console.log("OK");

console.log("=== statuses + channels ===");
assert(MESSAGE_STATUSES.includes("draft"), "draft");
assert(MESSAGE_STATUSES.includes("scheduled"), "scheduled");
assert(MESSAGE_STATUSES.includes("published"), "published");
assert(NOTIFY_CHANNELS.includes("in_app"), "in_app");
assert(NOTIFY_CHANNELS.includes("email"), "email");
assert(NOTIFY_CHANNELS.includes("whatsapp"), "whatsapp");
assert(DELIVERY_STATUSES.includes("read"), "read receipt status");
assert(DELIVERY_STATUSES.includes("queued"), "queued");
console.log("OK");

console.log("=== create message validation ===");
{
  const bad = validateCreateMessageInput({
    messageKind: "announcement",
    title: "",
    body: "",
  });
  assert(bad.title && bad.body, "required title/body");

  const dept = validateCreateMessageInput({
    messageKind: "department",
    title: "Dept note",
    body: "Hello",
  });
  assert(dept.departmentId, "department requires id");

  const klass = validateCreateMessageInput({
    messageKind: "class",
    title: "Class note",
    body: "Hello",
  });
  assert(klass.classId, "class requires id");

  const good = validateCreateMessageInput({
    messageKind: "circular",
    title: "Exam schedule",
    body: "Please note the dates.",
    channels: ["in_app", "email"],
    audience: { includeParents: true, includeStaff: true },
  });
  assert(Object.keys(good).length === 0, "good circular");

  const sched = validateCreateMessageInput({
    messageKind: "parent_notice",
    title: "PTM",
    body: "Saturday 10am",
    scheduledFor: "not-a-date",
  });
  assert(sched.scheduledFor, "bad schedule");
}
console.log("OK");

console.log("=== update validation ===");
{
  const bad = validateUpdateMessageInput({ id: "" });
  assert(bad.id, "id required");
  const good = validateUpdateMessageInput({
    id: "m1",
    title: "Updated",
  });
  assert(Object.keys(good).length === 0, "good update");
}
console.log("OK");

console.log("\nAll communication ops validation checks passed.");
