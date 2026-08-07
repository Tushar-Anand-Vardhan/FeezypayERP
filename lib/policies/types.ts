/** School Policy Engine (E07) — versioned admin policies. No runtime facts. */

export type PolicyActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type PolicyKind =
  | "attendance_rules"
  | "promotion_rules"
  | "working_hours"
  | "school_timings"
  | "leave_types"
  | "late_arrival"
  | "half_day"
  | "exam_eligibility"
  | "grace_marks"
  | "behaviour_rules"
  | "fee_rules"
  | "transport_rules";

export type PolicyStatus = "draft" | "published" | "retired";

export type PolicyInput = {
  id?: string;
  policyKind: PolicyKind;
  code?: string;
  name: string;
  description?: string;
  academicYearId?: string | null;
};

export type PolicyVersionInput = {
  policyId: string;
  versionId?: string;
  rules: Record<string, unknown>;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  changeSummary?: string;
};

export type WeekdayTiming = {
  weekday: number;
  openTime: string;
  closeTime: string;
};

export type LeaveTypeRule = {
  code: string;
  name: string;
  paid?: boolean;
  maxDaysPerYear?: number | null;
  requiresApproval?: boolean;
};

export const POLICY_KINDS: PolicyKind[] = [
  "attendance_rules",
  "promotion_rules",
  "working_hours",
  "school_timings",
  "leave_types",
  "late_arrival",
  "half_day",
  "exam_eligibility",
  "grace_marks",
  "behaviour_rules",
  "fee_rules",
  "transport_rules",
];

export const FUTURE_POLICY_KINDS: PolicyKind[] = [
  "fee_rules",
  "transport_rules",
];

export const POLICY_STATUSES: PolicyStatus[] = [
  "draft",
  "published",
  "retired",
];

export const POLICY_KIND_LABELS: Record<PolicyKind, string> = {
  attendance_rules: "Attendance rules",
  promotion_rules: "Promotion rules",
  working_hours: "Working hours",
  school_timings: "School timings",
  leave_types: "Leave types",
  late_arrival: "Late arrival",
  half_day: "Half day",
  exam_eligibility: "Exam eligibility",
  grace_marks: "Grace marks",
  behaviour_rules: "Behaviour rules",
  fee_rules: "Fee rules (future)",
  transport_rules: "Transport rules (future)",
};
