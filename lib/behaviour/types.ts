/** Behaviour Engine (E13) — types. */

export type BehaviourActionResult =
  | { success: true; message: string; id?: string; ids?: string[] }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type RemarkKind =
  | "positive"
  | "disciplinary"
  | "warning"
  | "commendation"
  | "teacher_note";

export type RemarkVisibility =
  | "private"
  | "staff"
  | "parent_visible"
  | "school";

export type IncidentStatus =
  | "open"
  | "under_review"
  | "resolved"
  | "dismissed";

export type Severity = "low" | "medium" | "high" | "critical";

export type FollowUpStatus =
  | "none"
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export type FollowUpActionType =
  | "note"
  | "meeting"
  | "parent_call"
  | "counseling"
  | "detention"
  | "suspension_referral"
  | "commendation_followup"
  | "other";

export type FollowUpRowStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export type CreateRemarkInput = {
  studentProfileId: string;
  academicYearId: string;
  remarkKind: RemarkKind;
  title: string;
  body?: string | null;
  description?: string | null;
  category?: string;
  severity?: Severity;
  visibility?: RemarkVisibility;
  status?: IncidentStatus;
  occurredOn?: string;
  recordedAt?: string;
  followUpRequired?: boolean;
  classId?: string | null;
  sectionId?: string | null;
  employmentId?: string | null;
  attachmentMediaIds?: string[];
};

export type UpdateRemarkInput = {
  id: string;
  title?: string;
  body?: string | null;
  description?: string | null;
  category?: string;
  severity?: Severity;
  visibility?: RemarkVisibility;
  status?: IncidentStatus;
  occurredOn?: string;
  followUpRequired?: boolean;
  followUpStatus?: FollowUpStatus;
};

export type CreateFollowUpInput = {
  conductIncidentId: string;
  actionType?: FollowUpActionType;
  title: string;
  description?: string | null;
  dueOn?: string | null;
  assignedToEmploymentId?: string | null;
};

export type UpdateFollowUpInput = {
  id: string;
  status?: FollowUpRowStatus;
  title?: string;
  description?: string | null;
  dueOn?: string | null;
  assignedToEmploymentId?: string | null;
};

export type BehaviourAnalyticsQuery = {
  academicYearId: string;
  studentProfileId?: string;
  sectionId?: string;
  classId?: string;
  remarkKind?: RemarkKind;
};

export const REMARK_KINDS: RemarkKind[] = [
  "positive",
  "disciplinary",
  "warning",
  "commendation",
  "teacher_note",
];

export const REMARK_VISIBILITIES: RemarkVisibility[] = [
  "private",
  "staff",
  "parent_visible",
  "school",
];

export const INCIDENT_STATUSES: IncidentStatus[] = [
  "open",
  "under_review",
  "resolved",
  "dismissed",
];

export const SEVERITIES: Severity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const FOLLOW_UP_ACTION_TYPES: FollowUpActionType[] = [
  "note",
  "meeting",
  "parent_call",
  "counseling",
  "detention",
  "suspension_referral",
  "commendation_followup",
  "other",
];

export const FOLLOW_UP_ROW_STATUSES: FollowUpRowStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];
