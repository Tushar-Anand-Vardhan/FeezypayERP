"use server";

import { revalidatePath } from "next/cache";
import {
  getActorId,
  visibilityForWorkflow,
  writeAttendanceAudit,
} from "@/lib/attendance/server-helpers";
import type { AttendanceActionResult } from "@/lib/attendance/types";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/attendance");
}

async function loadSession(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  schoolId: string,
  sessionId: string,
) {
  const { data } = await supabase
    .from("attendance_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("school_id", schoolId)
    .maybeSingle();
  return data;
}

async function syncRecordsWorkflow(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  sessionId: string,
  workflowStatus: string,
  actorId: string | null,
) {
  const vis = visibilityForWorkflow(workflowStatus);
  const patch: Record<string, unknown> = {
    workflow_status: workflowStatus,
    updated_at: new Date().toISOString(),
    ...vis,
  };
  if (workflowStatus === "approved") {
    patch.approved_at = new Date().toISOString();
    patch.approved_by = actorId;
  }
  if (workflowStatus === "locked") {
    patch.locked_at = new Date().toISOString();
    patch.locked_by = actorId;
    if (!vis.visible_to_guardians) {
      Object.assign(patch, visibilityForWorkflow("locked"));
    }
  }
  await supabase
    .from("attendance_records")
    .update(patch)
    .eq("session_id", sessionId)
    .is("superseded_at", null);
}

export async function submitAttendanceSessionAction(
  sessionId: string,
): Promise<AttendanceActionResult> {
  const context = await getAuthenticatedSchoolContext("attendance.session.approve");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const session = await loadSession(supabase, schoolId, sessionId);
  if (!session) {
    return { success: false, error: "Session not found." };
  }
  if (session.workflow_status !== "draft") {
    return { success: false, error: "Only draft sessions can be submitted." };
  }
  if (session.locked_at) {
    return { success: false, error: "Session is locked." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("attendance_sessions")
    .update({
      workflow_status: "submitted",
      submitted_at: now,
      submitted_by: actorId,
      updated_at: now,
    })
    .eq("id", sessionId);

  if (error) {
    return { success: false, error: error.message };
  }

  await syncRecordsWorkflow(supabase, sessionId, "submitted", actorId);
  await writeAttendanceAudit(supabase, {
    schoolId,
    action: "session.submit",
    actorId,
    sessionId,
    oldValues: { workflow_status: "draft" },
    newValues: { workflow_status: "submitted" },
  });

  revalidate();
  return {
    success: true,
    message: "Attendance submitted for approval.",
    sessionId,
  };
}

export async function approveAttendanceSessionAction(
  sessionId: string,
): Promise<AttendanceActionResult> {
  const context = await getAuthenticatedSchoolContext("attendance.session.approve");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const session = await loadSession(supabase, schoolId, sessionId);
  if (!session) {
    return { success: false, error: "Session not found." };
  }
  if (!["draft", "submitted"].includes(session.workflow_status)) {
    return {
      success: false,
      error: "Only draft or submitted sessions can be approved.",
    };
  }
  if (session.locked_at) {
    return { success: false, error: "Session is locked." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("attendance_sessions")
    .update({
      workflow_status: "approved",
      approved_at: now,
      approved_by: actorId,
      submitted_at: session.submitted_at ?? now,
      submitted_by: session.submitted_by ?? actorId,
      updated_at: now,
    })
    .eq("id", sessionId);

  if (error) {
    return { success: false, error: error.message };
  }

  await syncRecordsWorkflow(supabase, sessionId, "approved", actorId);
  await writeAttendanceAudit(supabase, {
    schoolId,
    action: "session.approve",
    actorId,
    sessionId,
    oldValues: { workflow_status: session.workflow_status },
    newValues: {
      workflow_status: "approved",
      visible_to_guardians: true,
      visible_to_students: true,
    },
  });

  revalidate();
  return {
    success: true,
    message: "Attendance approved — visible to parents and students.",
    sessionId,
  };
}

export async function lockAttendanceSessionAction(
  sessionId: string,
): Promise<AttendanceActionResult> {
  const context = await getAuthenticatedSchoolContext("attendance.session.approve");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const session = await loadSession(supabase, schoolId, sessionId);
  if (!session) {
    return { success: false, error: "Session not found." };
  }
  if (session.locked_at || session.workflow_status === "locked") {
    return { success: false, error: "Session is already locked." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("attendance_sessions")
    .update({
      workflow_status: "locked",
      locked_at: now,
      locked_by: actorId,
      approved_at: session.approved_at ?? now,
      approved_by: session.approved_by ?? actorId,
      updated_at: now,
    })
    .eq("id", sessionId);

  if (error) {
    return { success: false, error: error.message };
  }

  await syncRecordsWorkflow(supabase, sessionId, "locked", actorId);
  await writeAttendanceAudit(supabase, {
    schoolId,
    action: "session.lock",
    actorId,
    sessionId,
    oldValues: { workflow_status: session.workflow_status },
    newValues: { workflow_status: "locked" },
  });

  revalidate();
  return {
    success: true,
    message: "Attendance locked.",
    sessionId,
  };
}

export async function unlockAttendanceSessionAction(
  sessionId: string,
): Promise<AttendanceActionResult> {
  const context = await getAuthenticatedSchoolContext("attendance.session.approve");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const session = await loadSession(supabase, schoolId, sessionId);
  if (!session) {
    return { success: false, error: "Session not found." };
  }
  if (!session.locked_at && session.workflow_status !== "locked") {
    return { success: false, error: "Session is not locked." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("attendance_sessions")
    .update({
      workflow_status: "approved",
      locked_at: null,
      locked_by: null,
      updated_at: now,
    })
    .eq("id", sessionId);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase
    .from("attendance_records")
    .update({
      workflow_status: "approved",
      locked_at: null,
      locked_by: null,
      updated_at: now,
      ...visibilityForWorkflow("approved"),
    })
    .eq("session_id", sessionId)
    .is("superseded_at", null);

  await writeAttendanceAudit(supabase, {
    schoolId,
    action: "session.unlock",
    actorId,
    sessionId,
    oldValues: { workflow_status: "locked" },
    newValues: { workflow_status: "approved" },
  });

  revalidate();
  return {
    success: true,
    message: "Attendance unlocked (still approved).",
    sessionId,
  };
}
