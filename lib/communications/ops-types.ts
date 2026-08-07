/** Communication Operations (E18 compose) — types. */

export type CommOpsActionResult =
  | {
      success: true;
      message: string;
      id?: string;
      deliveryCount?: number;
    }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type MessageKind =
  | "announcement"
  | "circular"
  | "department"
  | "teacher"
  | "class"
  | "parent_notice"
  | "student_notice";

export type MessageStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "cancelled"
  | "archived";

export type MessageAudience = {
  roles?: string[];
  classIds?: string[];
  sectionIds?: string[];
  studentProfileIds?: string[];
  parentProfileIds?: string[];
  employmentIds?: string[];
  includeParents?: boolean;
  includeStudents?: boolean;
  includeStaff?: boolean;
};

export type CreateMessageInput = {
  academicYearId?: string | null;
  messageKind: MessageKind;
  title: string;
  body: string;
  categoryId?: string | null;
  priorityId?: string | null;
  audienceGroupId?: string | null;
  templateId?: string | null;
  templateVersionId?: string | null;
  departmentId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  audience?: MessageAudience;
  channels?: Array<"in_app" | "email" | "whatsapp" | "sms" | "push">;
  attachmentMediaIds?: string[];
  scheduledFor?: string | null;
  /** If true and no schedule, publish immediately */
  publishNow?: boolean;
  employmentId?: string | null;
  departmentAnnouncementId?: string | null;
};

export type UpdateMessageInput = {
  id: string;
  title?: string;
  body?: string;
  audience?: MessageAudience;
  channels?: Array<"in_app" | "email" | "whatsapp" | "sms" | "push">;
  attachmentMediaIds?: string[];
  scheduledFor?: string | null;
  categoryId?: string | null;
  priorityId?: string | null;
};

export const MESSAGE_KINDS: MessageKind[] = [
  "announcement",
  "circular",
  "department",
  "teacher",
  "class",
  "parent_notice",
  "student_notice",
];

export const MESSAGE_STATUSES: MessageStatus[] = [
  "draft",
  "scheduled",
  "published",
  "cancelled",
  "archived",
];

export const KIND_TO_NOTIFY_TYPE: Record<MessageKind, string> = {
  announcement: "communication.announcement",
  circular: "communication.circular",
  department: "communication.department",
  teacher: "communication.teacher",
  class: "communication.class",
  parent_notice: "communication.parent_notice",
  student_notice: "communication.student_notice",
};
