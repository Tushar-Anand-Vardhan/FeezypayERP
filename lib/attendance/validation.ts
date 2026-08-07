import type {
  AttendanceMarkStatus,
  BulkDailyMarkInput,
  DailyMarkInput,
  LeaveRequestInput,
  PeriodMarkInput,
} from "@/lib/attendance/types";
import { ATTENDANCE_MARK_STATUSES } from "@/lib/attendance/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

export function validateMarkStatus(
  status: string,
): status is AttendanceMarkStatus {
  return (ATTENDANCE_MARK_STATUSES as string[]).includes(status);
}

export function validateDailyMarkInput(
  input: DailyMarkInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.studentProfileId?.trim()) {
    errors.studentProfileId = "Student is required.";
  }
  if (!input.sectionId?.trim()) {
    errors.sectionId = "Section is required.";
  }
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!input.attendanceDate || !isValidDate(input.attendanceDate)) {
    errors.attendanceDate = "Attendance date is invalid.";
  }
  if (!validateMarkStatus(input.status)) {
    errors.status = "Invalid attendance status.";
  }
  if (input.status === "late" && input.lateMinutes != null && input.lateMinutes < 0) {
    errors.lateMinutes = "Late minutes cannot be negative.";
  }
  if (input.status === "leave" && !input.leaveType?.trim()) {
    errors.leaveType = "Leave type is required for leave status.";
  }
  return errors;
}

export function validateBulkDailyMarkInput(
  input: BulkDailyMarkInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.sectionId?.trim()) {
    errors.sectionId = "Section is required.";
  }
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!input.attendanceDate || !isValidDate(input.attendanceDate)) {
    errors.attendanceDate = "Attendance date is invalid.";
  }
  if (!input.marks?.length) {
    errors.marks = "At least one mark is required.";
  } else {
    input.marks.forEach((m, i) => {
      if (!m.studentProfileId?.trim()) {
        errors[`marks.${i}.studentProfileId`] = "Student is required.";
      }
      if (!validateMarkStatus(m.status)) {
        errors[`marks.${i}.status`] = "Invalid status.";
      }
    });
  }
  return errors;
}

export function validatePeriodMarkInput(
  input: PeriodMarkInput,
): Record<string, string> {
  const errors = validateDailyMarkInput(input);
  if (!input.periodDefinitionId?.trim()) {
    errors.periodDefinitionId = "Period is required for period attendance.";
  }
  if (!input.enablePeriodAttendance) {
    errors.enablePeriodAttendance =
      "Period attendance is FUTURE — pass enablePeriodAttendance to opt in.";
  }
  return errors;
}

export function validateLeaveRequestInput(
  input: LeaveRequestInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.studentProfileId?.trim()) {
    errors.studentProfileId = "Student is required.";
  }
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!input.leaveType?.trim()) {
    errors.leaveType = "Leave type is required.";
  }
  if (!input.startDate || !isValidDate(input.startDate)) {
    errors.startDate = "Start date is invalid.";
  }
  if (!input.endDate || !isValidDate(input.endDate)) {
    errors.endDate = "End date is invalid.";
  }
  if (
    input.startDate &&
    input.endDate &&
    isValidDate(input.startDate) &&
    isValidDate(input.endDate) &&
    input.endDate < input.startDate
  ) {
    errors.endDate = "End date must be on or after start date.";
  }
  return errors;
}

export function eachDateInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(start + "T12:00:00");
  const last = new Date(end + "T12:00:00");
  while (cur <= last) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function teacherMayEditWorkflow(status: string, lockedAt: string | null): boolean {
  if (lockedAt) return false;
  return status === "draft" || status === "submitted";
}

export function visibilityForWorkflow(status: string): {
  visible_to_guardians: boolean;
  visible_to_students: boolean;
} {
  const open = status === "approved" || status === "locked";
  return {
    visible_to_guardians: open,
    visible_to_students: open,
  };
}
