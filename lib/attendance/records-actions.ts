"use server";

import { revalidatePath } from "next/cache";
import {
  assertEmploymentOwned,
  assertSectionInSchool,
  assertStudentInSchool,
  assertTeacherCanEditSession,
  assertYearOwned,
  getActorId,
  getOrCreateDailySession,
  listActiveStudentsInSection,
  visibilityForWorkflow,
  writeAttendanceAudit,
} from "@/lib/attendance/server-helpers";
import type {
  AttendanceActionResult,
  BulkDailyMarkInput,
  DailyMarkInput,
  PeriodMarkInput,
} from "@/lib/attendance/types";
import {
  validateBulkDailyMarkInput,
  validateDailyMarkInput,
  validatePeriodMarkInput,
} from "@/lib/attendance/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/attendance");
}

async function upsertMarkRow(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  input: {
    schoolId: string;
    sessionId: string;
    studentProfileId: string;
    academicYearId: string;
    sectionId: string;
    attendanceDate: string;
    status: string;
    scope: "daily" | "period";
    periodDefinitionId?: string | null;
    lateMinutes?: number | null;
    leaveType?: string | null;
    notes?: string | null;
    employmentId?: string | null;
    actorId: string | null;
    workflowStatus: string;
  },
): Promise<{ id: string } | { error: string }> {
  const vis = visibilityForWorkflow(input.workflowStatus);
  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id, status, workflow_status, locked_at")
    .eq("student_profile_id", input.studentProfileId)
    .eq("attendance_date", input.attendanceDate)
    .is("superseded_at", null)
    .eq("is_correction", false)
    .is(
      "period_definition_id",
      input.periodDefinitionId ?? null,
    )
    .maybeSingle();

  if (existing) {
    if (
      !teacherMayEditFromRow(
        existing.workflow_status,
        existing.locked_at as string | null,
      )
    ) {
      return {
        error:
          "Existing mark is approved or locked — use correctAttendanceAction.",
      };
    }

    const { data: updated, error } = await supabase
      .from("attendance_records")
      .update({
        session_id: input.sessionId,
        status: input.status,
        late_minutes:
          input.status === "late" ? (input.lateMinutes ?? null) : null,
        leave_type:
          input.status === "leave" ? (input.leaveType ?? null) : null,
        notes: input.notes ?? null,
        recorded_by: input.actorId,
        recorded_by_employment_id: input.employmentId ?? null,
        workflow_status: input.workflowStatus,
        updated_at: new Date().toISOString(),
        ...vis,
      })
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();

    if (error || !updated) {
      return { error: error?.message ?? "Failed to update attendance." };
    }
    return { id: updated.id };
  }

  const { data: inserted, error } = await supabase
    .from("attendance_records")
    .insert({
      school_id: input.schoolId,
      session_id: input.sessionId,
      student_profile_id: input.studentProfileId,
      academic_year_id: input.academicYearId,
      section_id: input.sectionId,
      attendance_date: input.attendanceDate,
      status: input.status,
      scope: input.scope,
      period_definition_id: input.periodDefinitionId ?? null,
      late_minutes:
        input.status === "late" ? (input.lateMinutes ?? null) : null,
      leave_type: input.status === "leave" ? (input.leaveType ?? null) : null,
      notes: input.notes ?? null,
      recorded_by: input.actorId,
      recorded_by_employment_id: input.employmentId ?? null,
      workflow_status: input.workflowStatus,
      ...vis,
    })
    .select("id")
    .maybeSingle();

  if (error || !inserted) {
    return { error: error?.message ?? "Failed to insert attendance." };
  }
  return { id: inserted.id };
}

function teacherMayEditFromRow(
  workflowStatus: string,
  lockedAt: string | null,
): boolean {
  if (lockedAt) return false;
  return workflowStatus === "draft" || workflowStatus === "submitted";
}

export async function upsertDailyAttendanceAction(
  input: DailyMarkInput,
): Promise<AttendanceActionResult> {
  const context = await getAuthenticatedSchoolContext("attendance.record.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateDailyMarkInput(input);
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
  const section = await assertSectionInSchool(
    supabase,
    schoolId,
    input.sectionId,
  );
  if (!section) {
    return { success: false, error: "Section not found." };
  }
  if (
    !(await assertStudentInSchool(supabase, schoolId, input.studentProfileId))
  ) {
    return { success: false, error: "Student not found in this school." };
  }
  if (
    input.employmentId &&
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const session = await getOrCreateDailySession(supabase, {
    schoolId,
    academicYearId: input.academicYearId,
    sectionId: input.sectionId,
    attendanceDate: input.attendanceDate,
    employmentId: input.employmentId,
  });
  if ("error" in session) {
    return { success: false, error: session.error };
  }

  const editBlock = assertTeacherCanEditSession(session);
  if (editBlock) {
    return { success: false, error: editBlock };
  }

  const result = await upsertMarkRow(supabase, {
    schoolId,
    sessionId: session.id,
    studentProfileId: input.studentProfileId,
    academicYearId: input.academicYearId,
    sectionId: input.sectionId,
    attendanceDate: input.attendanceDate,
    status: input.status,
    scope: "daily",
    lateMinutes: input.lateMinutes,
    leaveType: input.leaveType,
    notes: input.notes,
    employmentId: input.employmentId,
    actorId,
    workflowStatus: session.workflow_status,
  });

  if ("error" in result) {
    return { success: false, error: result.error };
  }

  await writeAttendanceAudit(supabase, {
    schoolId,
    action: "mark.daily",
    actorId,
    employmentId: input.employmentId,
    sessionId: session.id,
    recordId: result.id,
    newValues: {
      status: input.status,
      studentProfileId: input.studentProfileId,
      attendanceDate: input.attendanceDate,
    },
  });

  const { emitDomainEvent } = await import("@/lib/domain-events/emit");
  await emitDomainEvent(supabase, {
    schoolId,
    eventType: "attendance.record.marked",
    aggregateType: "attendance_record",
    aggregateId: result.id,
    payload: {
      status: input.status,
      studentProfileId: input.studentProfileId,
      attendanceDate: input.attendanceDate,
      sectionId: input.sectionId,
      academicYearId: input.academicYearId,
      sessionId: session.id,
    },
    idempotencyKey: `attendance.marked:${result.id}:${input.status}`,
  });

  revalidate();
  return {
    success: true,
    message: "Attendance saved.",
    id: result.id,
    sessionId: session.id,
  };
}

export async function bulkMarkDailyAttendanceAction(
  input: BulkDailyMarkInput,
): Promise<AttendanceActionResult> {
  const context = await getAuthenticatedSchoolContext("attendance.record.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateBulkDailyMarkInput(input);
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
  if (!(await assertSectionInSchool(supabase, schoolId, input.sectionId))) {
    return { success: false, error: "Section not found." };
  }
  if (
    input.employmentId &&
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const roster = await listActiveStudentsInSection(
    supabase,
    input.sectionId,
  );
  const rosterSet = new Set(roster);

  const session = await getOrCreateDailySession(supabase, {
    schoolId,
    academicYearId: input.academicYearId,
    sectionId: input.sectionId,
    attendanceDate: input.attendanceDate,
    employmentId: input.employmentId,
  });
  if ("error" in session) {
    return { success: false, error: session.error };
  }

  const editBlock = assertTeacherCanEditSession(session);
  if (editBlock) {
    return { success: false, error: editBlock };
  }

  let saved = 0;
  for (const mark of input.marks) {
    if (!rosterSet.has(mark.studentProfileId)) {
      return {
        success: false,
        error: `Student ${mark.studentProfileId} is not active in this section.`,
      };
    }
    const result = await upsertMarkRow(supabase, {
      schoolId,
      sessionId: session.id,
      studentProfileId: mark.studentProfileId,
      academicYearId: input.academicYearId,
      sectionId: input.sectionId,
      attendanceDate: input.attendanceDate,
      status: mark.status,
      scope: "daily",
      lateMinutes: mark.lateMinutes,
      leaveType: mark.leaveType,
      notes: mark.notes,
      employmentId: input.employmentId,
      actorId,
      workflowStatus: session.workflow_status,
    });
    if ("error" in result) {
      return { success: false, error: result.error };
    }
    saved += 1;

    if (mark.status === "absent") {
      const { emitDomainEvent } = await import("@/lib/domain-events/emit");
      await emitDomainEvent(supabase, {
        schoolId,
        eventType: "attendance.record.marked",
        aggregateType: "attendance_record",
        aggregateId: result.id,
        payload: {
          status: mark.status,
          studentProfileId: mark.studentProfileId,
          attendanceDate: input.attendanceDate,
          sectionId: input.sectionId,
          academicYearId: input.academicYearId,
          sessionId: session.id,
        },
        idempotencyKey: `attendance.marked:${result.id}:absent`,
      });
    }
  }

  await writeAttendanceAudit(supabase, {
    schoolId,
    action: "mark.bulk_daily",
    actorId,
    employmentId: input.employmentId,
    sessionId: session.id,
    metadata: { count: saved, attendanceDate: input.attendanceDate },
  });

  revalidate();
  return {
    success: true,
    message: `Saved ${saved} attendance mark(s).`,
    sessionId: session.id,
  };
}

/** Period attendance — schema ready; requires explicit opt-in flag. */
export async function markPeriodAttendanceAction(
  input: PeriodMarkInput,
): Promise<AttendanceActionResult> {
  const fieldErrors = validatePeriodMarkInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Period attendance is not enabled for general use yet.",
      fieldErrors,
    };
  }

  // FUTURE path reserved — same upsert with scope=period when opted in
  const context = await getAuthenticatedSchoolContext("attendance.record.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  return {
    success: false,
    error:
      "Period attendance API is reserved (FUTURE). Use daily attendance until period UI ships.",
  };
}

export async function correctAttendanceAction(input: {
  recordId: string;
  status: DailyMarkInput["status"];
  lateMinutes?: number | null;
  leaveType?: string | null;
  notes?: string | null;
  employmentId?: string | null;
}): Promise<AttendanceActionResult> {
  const context = await getAuthenticatedSchoolContext("attendance.record.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const { data: original } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("id", input.recordId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!original) {
    return { success: false, error: "Attendance record not found." };
  }

  const canDirectEdit = teacherMayEditFromRow(
    original.workflow_status,
    original.locked_at,
  );

  if (canDirectEdit) {
    const { error } = await supabase
      .from("attendance_records")
      .update({
        status: input.status,
        late_minutes:
          input.status === "late" ? (input.lateMinutes ?? null) : null,
        leave_type:
          input.status === "leave" ? (input.leaveType ?? null) : null,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
        recorded_by: actorId,
      })
      .eq("id", original.id);

    if (error) {
      return { success: false, error: error.message };
    }

    await writeAttendanceAudit(supabase, {
      schoolId,
      action: "correct.direct",
      actorId,
      employmentId: input.employmentId,
      recordId: original.id,
      sessionId: original.session_id,
      oldValues: { status: original.status },
      newValues: { status: input.status },
    });

    revalidate();
    return { success: true, message: "Attendance updated.", id: original.id };
  }

  // Compensating correction after approve/lock
  const now = new Date().toISOString();
  await supabase
    .from("attendance_records")
    .update({ superseded_at: now, updated_at: now })
    .eq("id", original.id);

  const vis = visibilityForWorkflow(original.workflow_status);
  const { data: correction, error } = await supabase
    .from("attendance_records")
    .insert({
      school_id: schoolId,
      session_id: original.session_id,
      student_profile_id: original.student_profile_id,
      academic_year_id: original.academic_year_id,
      section_id: original.section_id,
      attendance_date: original.attendance_date,
      status: input.status,
      scope: original.scope,
      period_definition_id: original.period_definition_id,
      late_minutes:
        input.status === "late" ? (input.lateMinutes ?? null) : null,
      leave_type: input.status === "leave" ? (input.leaveType ?? null) : null,
      notes: input.notes ?? `Correction of ${original.id}`,
      recorded_by: actorId,
      recorded_by_employment_id: input.employmentId ?? null,
      workflow_status: original.workflow_status,
      approved_at: original.approved_at,
      approved_by: original.approved_by,
      locked_at: original.locked_at,
      locked_by: original.locked_by,
      correction_of_id: original.id,
      is_correction: true,
      ...vis,
    })
    .select("id")
    .maybeSingle();

  if (error || !correction) {
    return {
      success: false,
      error: error?.message ?? "Failed to write correction.",
    };
  }

  await writeAttendanceAudit(supabase, {
    schoolId,
    action: "correct.compensating",
    actorId,
    employmentId: input.employmentId,
    recordId: correction.id,
    sessionId: original.session_id,
    oldValues: { status: original.status, recordId: original.id },
    newValues: { status: input.status, recordId: correction.id },
  });

  revalidate();
  return {
    success: true,
    message: "Correction recorded.",
    id: correction.id,
  };
}
