"use server";

import { assertStudentInSchool } from "@/lib/attendance/server-helpers";
import type { AttendanceAnalyticsQuery } from "@/lib/attendance/types";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listSectionAttendanceAction(input: {
  sectionId: string;
  attendanceDate: string;
  includeSuperseded?: boolean;
}): Promise<
  | {
      success: true;
      session: Record<string, unknown> | null;
      records: Array<Record<string, unknown>>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("attendance.record.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  const { data: session } = await supabase
    .from("attendance_sessions")
    .select("*")
    .eq("school_id", schoolId)
    .eq("section_id", input.sectionId)
    .eq("attendance_date", input.attendanceDate)
    .eq("scope", "daily")
    .is("period_definition_id", null)
    .maybeSingle();

  let query = supabase
    .from("attendance_records")
    .select(
      "id, student_profile_id, status, late_minutes, leave_type, notes, workflow_status, visible_to_guardians, visible_to_students, session_id, is_correction, correction_of_id, superseded_at, created_at, updated_at",
    )
    .eq("school_id", schoolId)
    .eq("section_id", input.sectionId)
    .eq("attendance_date", input.attendanceDate)
    .is("period_definition_id", null)
    .order("created_at", { ascending: true });

  if (!input.includeSuperseded) {
    query = query.is("superseded_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, session: session ?? null, records: data ?? [] };
}

/**
 * Student/parent-facing list. When visibleOnly=true, only approved/locked
 * visible flags are returned (automatic availability after approve/lock).
 */
export async function listStudentAttendanceAction(input: {
  studentProfileId: string;
  fromDate?: string;
  toDate?: string;
  visibleOnly?: boolean;
}): Promise<
  | { success: true; records: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("attendance.record.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (
    !(await assertStudentInSchool(supabase, schoolId, input.studentProfileId))
  ) {
    return { success: false, error: "Student not found in this school." };
  }

  let query = supabase
    .from("attendance_records")
    .select(
      "id, attendance_date, status, late_minutes, leave_type, notes, workflow_status, visible_to_guardians, visible_to_students, section_id, scope, period_definition_id",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .is("superseded_at", null)
    .order("attendance_date", { ascending: false });

  if (input.visibleOnly) {
    query = query.or(
      "visible_to_guardians.eq.true,visible_to_students.eq.true",
    );
  }
  if (input.fromDate) {
    query = query.gte("attendance_date", input.fromDate);
  }
  if (input.toDate) {
    query = query.lte("attendance_date", input.toDate);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, records: data ?? [] };
}

export async function getAttendanceAnalyticsAction(
  query: AttendanceAnalyticsQuery,
): Promise<
  | {
      success: true;
      analytics: {
        total: number;
        byStatus: Record<string, number>;
        presentRate: number | null;
        lateCount: number;
        leaveCount: number;
        halfDayCount: number;
        absentCount: number;
      };
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("attendance.record.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  let q = context.supabase
    .from("attendance_records")
    .select("status")
    .eq("school_id", context.schoolId)
    .eq("academic_year_id", query.academicYearId)
    .is("superseded_at", null)
    .eq("is_correction", false);

  if (query.sectionId) {
    q = q.eq("section_id", query.sectionId);
  }
  if (query.studentProfileId) {
    q = q.eq("student_profile_id", query.studentProfileId);
  }
  if (query.fromDate) {
    q = q.gte("attendance_date", query.fromDate);
  }
  if (query.toDate) {
    q = q.lte("attendance_date", query.toDate);
  }

  const { data, error } = await q;
  if (error) {
    return { success: false, error: error.message };
  }

  const byStatus: Record<string, number> = {};
  for (const row of data ?? []) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  }
  const total = data?.length ?? 0;
  const presentish =
    (byStatus.present ?? 0) + (byStatus.late ?? 0) + (byStatus.half_day ?? 0);

  return {
    success: true,
    analytics: {
      total,
      byStatus,
      presentRate: total === 0 ? null : presentish / total,
      lateCount: byStatus.late ?? 0,
      leaveCount: byStatus.leave ?? 0,
      halfDayCount: byStatus.half_day ?? 0,
      absentCount: byStatus.absent ?? 0,
    },
  };
}

export async function listAttendanceAuditAction(input?: {
  sessionId?: string;
  recordId?: string;
  limit?: number;
}): Promise<
  | { success: true; entries: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("attendance.record.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  let query = context.supabase
    .from("attendance_audit_log")
    .select(
      "id, action, session_id, record_id, leave_request_id, actor_id, employment_id, old_values, new_values, metadata, created_at",
    )
    .eq("school_id", context.schoolId)
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 100);

  if (input?.sessionId) {
    query = query.eq("session_id", input.sessionId);
  }
  if (input?.recordId) {
    query = query.eq("record_id", input.recordId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, entries: data ?? [] };
}
