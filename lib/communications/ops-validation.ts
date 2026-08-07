import type {
  CreateMessageInput,
  UpdateMessageInput,
} from "@/lib/communications/ops-types";
import { MESSAGE_KINDS } from "@/lib/communications/ops-types";

export function validateCreateMessageInput(
  input: CreateMessageInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!(MESSAGE_KINDS as string[]).includes(input.messageKind)) {
    errors.messageKind = "Invalid message kind.";
  }
  if (!input.title?.trim()) {
    errors.title = "Title is required.";
  }
  if (!input.body?.trim()) {
    errors.body = "Body is required.";
  }
  if (input.messageKind === "department" && !input.departmentId?.trim()) {
    errors.departmentId = "Department is required.";
  }
  if (input.messageKind === "class" && !input.classId?.trim()) {
    errors.classId = "Class is required.";
  }
  if (
    input.scheduledFor &&
    Number.isNaN(Date.parse(input.scheduledFor))
  ) {
    errors.scheduledFor = "Schedule time is invalid.";
  }
  return errors;
}

export function validateUpdateMessageInput(
  input: UpdateMessageInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.id?.trim()) {
    errors.id = "Message id is required.";
  }
  if (
    input.scheduledFor &&
    Number.isNaN(Date.parse(input.scheduledFor))
  ) {
    errors.scheduledFor = "Schedule time is invalid.";
  }
  return errors;
}
