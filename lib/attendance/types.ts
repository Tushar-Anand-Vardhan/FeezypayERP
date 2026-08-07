/** Attendance Engine (E12) types. */

export type AttendanceActionResult =
  | { success: true; message: string; id?: string; sessionId?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type AttendanceMarkStatus =
  | "present"
  | "absent"
  | "late"
  | "half_day"
  | "excused"
  | "leave";

export type AttendanceScope = "daily" | "period";

export type AttendanceWorkflowStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "locked";

export type LeaveRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type DailyMarkInput = {
  studentProfileId: string;
  sectionId: string;
  academicYearId: string;
  attendanceDate: string;
  status: AttendanceMarkStatus;
  lateMinutes?: number | null;
  leaveType?: string | null;
  notes?: string | null;
  employmentId?: string | null;
};

export type BulkDailyMarkInput = {
  sectionId: string;
  academicYearId: string;
  attendanceDate: string;
  employmentId?: string | null;
  marks: Array<{
    studentProfileId: string;
    status: AttendanceMarkStatus;
    lateMinutes?: number | null;
    leaveType?: string | null;
    notes?: string | null;
  }>;
};

export type PeriodMarkInput = DailyMarkInput & {
  periodDefinitionId: string;
  /** Explicit opt-in until period UI ships */
  enablePeriodAttendance?: boolean;
};

export type LeaveRequestInput = {
  studentProfileId: string;
  academicYearId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
};

export type AttendanceAnalyticsQuery = {
  academicYearId: string;
  sectionId?: string;
  studentProfileId?: string;
  fromDate?: string;
  toDate?: string;
};

export const ATTENDANCE_MARK_STATUSES: AttendanceMarkStatus[] = [
  "present",
  "absent",
  "late",
  "half_day",
  "excused",
  "leave",
];

export const ATTENDANCE_WORKFLOW_STATUSES: AttendanceWorkflowStatus[] = [
  "draft",
  "submitted",
  "approved",
  "locked",
];

export const TEACHER_EDITABLE_WORKFLOWS: AttendanceWorkflowStatus[] = [
  "draft",
  "submitted",
];
