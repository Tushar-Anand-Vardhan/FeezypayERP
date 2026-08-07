"use server";

import { revalidatePath } from "next/cache";
import {
  assertStudentInSchool,
  assertYearOwned,
  getActorId,
  getOrCreateDailySession,
  visibilityForWorkflow,
  writeAttendanceAudit,
} from "@/lib/attendance/server-helpers";
import type {
  AttendanceActionResult,
  LeaveRequestInput,
} from "@/lib/attendance/types";
import {
  eachDateInclusive,
  validateLeaveRequestInput,
} from "@/lib/attendance/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/attendance");
}

export async function createLeaveRequestAction(
  input: LeaveRequestInput,
): Promise<AttendanceActionResult> {
  const context = await getAuthenticatedSchoolContext("attendance.leave.decide");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateLeaveRequestInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }
  if (
    !(await assertStudentInSchool(supabase, schoolId, input.studentProfileId))
  ) {
    return { success: false, error: "Student not found in this school." };
  }

  const { data, error } = await supabase
    .from("attendance_leave_requests")
    .insert({
      school_id: schoolId,
      student_profile_id: input.studentProfileId,
      academic_year_id: input.academicYearId,
      leave_type: input.leaveType.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      reason: input.reason?.trim() || null,
      status: "pending",
      requested_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to create leave request.",
    };
  }

  await writeAttendanceAudit(supabase, {
    schoolId,
    action: "leave.create",
    actorId,
    leaveRequestId: data.id,
    newValues: {
      studentProfileId: input.studentProfileId,
      startDate: input.startDate,
      endDate: input.endDate,
      leaveType: input.leaveType,
    },
  });

  revalidate();
  return { success: true, message: "Leave request created.", id: data.id };
}

export async function decideLeaveRequestAction(input: {
  leaveRequestId: string;
  decision: "approved" | "rejected" | "cancelled";
  decisionNotes?: string;
  /** Required when approving — section used to attach daily leave marks */
  sectionId?: string;
}): Promise<AttendanceActionResult> {
  const context = await getAuthenticatedSchoolContext("attendance.leave.decide");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const { data: leave } = await supabase
    .from("attendance_leave_requests")
    .select("*")
    .eq("id", input.leaveRequestId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!leave) {
    return { success: false, error: "Leave request not found." };
  }
  if (leave.status !== "pending" && input.decision !== "cancelled") {
    return { success: false, error: "Leave request is not pending." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("attendance_leave_requests")
    .update({
      status: input.decision,
      decided_by: actorId,
      decided_at: now,
      decision_notes: input.decisionNotes?.trim() || null,
      updated_at: now,
    })
    .eq("id", leave.id);

  if (error) {
    return { success: false, error: error.message };
  }

  if (input.decision === "approved") {
    if (!input.sectionId) {
      return {
        success: false,
        error: "sectionId is required when approving leave.",
      };
    }

    const dates = eachDateInclusive(leave.start_date, leave.end_date);
    for (const date of dates) {
      const session = await getOrCreateDailySession(supabase, {
        schoolId,
        academicYearId: leave.academic_year_id,
        sectionId: input.sectionId,
        attendanceDate: date,
      });
      if ("error" in session) {
        return { success: false, error: session.error };
      }

      const vis = visibilityForWorkflow(
        session.workflow_status === "draft"
          ? "approved"
          : session.workflow_status,
      );

      const { data: existing } = await supabase
        .from("attendance_records")
        .select("id, workflow_status, locked_at")
        .eq("student_profile_id", leave.student_profile_id)
        .eq("attendance_date", date)
        .is("period_definition_id", null)
        .is("superseded_at", null)
        .eq("is_correction", false)
        .maybeSingle();

      if (existing?.locked_at || existing?.workflow_status === "locked") {
        continue;
      }

      if (existing) {
        await supabase
          .from("attendance_records")
          .update({
            status: "leave",
            leave_type: leave.leave_type,
            session_id: session.id,
            workflow_status:
              session.workflow_status === "draft"
                ? "approved"
                : session.workflow_status,
            notes: `Leave request ${leave.id}`,
            updated_at: now,
            ...vis,
            approved_at: now,
            approved_by: actorId,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("attendance_records").insert({
          school_id: schoolId,
          session_id: session.id,
          student_profile_id: leave.student_profile_id,
          academic_year_id: leave.academic_year_id,
          section_id: input.sectionId,
          attendance_date: date,
          status: "leave",
          leave_type: leave.leave_type,
          scope: "daily",
          workflow_status: "approved",
          notes: `Leave request ${leave.id}`,
          recorded_by: actorId,
          approved_at: now,
          approved_by: actorId,
          ...visibilityForWorkflow("approved"),
        });
      }
    }
  }

  await writeAttendanceAudit(supabase, {
    schoolId,
    action: `leave.${input.decision}`,
    actorId,
    leaveRequestId: leave.id,
    oldValues: { status: leave.status },
    newValues: { status: input.decision },
  });

  revalidate();
  return {
    success: true,
    message: `Leave request ${input.decision}.`,
    id: leave.id,
  };
}

export async function listLeaveRequestsAction(options?: {
  status?: string;
  studentProfileId?: string;
}): Promise<
  | { success: true; leaves: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("attendance.leave.decide");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  let query = context.supabase
    .from("attendance_leave_requests")
    .select(
      "id, student_profile_id, academic_year_id, leave_type, start_date, end_date, reason, status, decided_at, decision_notes, created_at",
    )
    .eq("school_id", context.schoolId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.studentProfileId) {
    query = query.eq("student_profile_id", options.studentProfileId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, leaves: data ?? [] };
}
