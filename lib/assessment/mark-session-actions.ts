"use server";

import { revalidatePath } from "next/cache";
import { getActorId } from "@/lib/assessment/server-helpers";
import {
  visibilityForMarksWorkflow,
  writeAssessmentAudit,
} from "@/lib/assessment/ops-server-helpers";
import type { AssessmentOpsActionResult } from "@/lib/assessment/ops-types";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/assessments");
}

async function loadSession(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  schoolId: string,
  sessionId: string,
) {
  const { data } = await supabase
    .from("assessment_mark_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("school_id", schoolId)
    .maybeSingle();
  return data;
}

async function syncResultsWorkflow(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  sessionId: string,
  workflowStatus: string,
  actorId: string | null,
) {
  const vis = visibilityForMarksWorkflow(workflowStatus);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    workflow_status: workflowStatus,
    updated_at: now,
    ...vis,
  };
  if (workflowStatus === "published") {
    patch.published_at = now;
  }
  if (workflowStatus === "locked") {
    patch.locked_at = now;
    patch.locked_by = actorId;
    if (!patch.published_at) {
      patch.published_at = now;
    }
  }

  await supabase
    .from("exam_results")
    .update(patch)
    .eq("mark_session_id", sessionId)
    .is("superseded_at", null);
}

/** Draft → published: opens parent/student visibility; teachers may still edit. */
export async function publishMarkSessionAction(
  sessionId: string,
): Promise<AssessmentOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.results.publish");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const session = await loadSession(supabase, schoolId, sessionId);
  if (!session) {
    return { success: false, error: "Mark session not found." };
  }
  if (session.locked_at || session.workflow_status === "locked") {
    return { success: false, error: "Session is locked." };
  }
  if (session.workflow_status === "published") {
    return { success: true, message: "Already published.", sessionId };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("assessment_mark_sessions")
    .update({
      workflow_status: "published",
      published_at: now,
      published_by: actorId,
      updated_at: now,
    })
    .eq("id", sessionId);

  if (error) {
    return { success: false, error: error.message };
  }

  await syncResultsWorkflow(supabase, sessionId, "published", actorId);
  await writeAssessmentAudit(supabase, {
    schoolId,
    action: "session.publish",
    actorId,
    markSessionId: sessionId,
    examDefinitionId: session.exam_definition_id,
    oldValues: { workflow_status: session.workflow_status },
    newValues: { workflow_status: "published" },
  });

  const { emitDomainEvent } = await import("@/lib/domain-events/emit");
  await emitDomainEvent(supabase, {
    schoolId,
    eventType: "assessment.results.published",
    aggregateType: "assessment_mark_session",
    aggregateId: sessionId,
    payload: {
      sessionId,
      sectionId: session.section_id,
      academicYearId: session.academic_year_id,
      examDefinitionId: session.exam_definition_id,
      examLabel: null,
    },
    idempotencyKey: `assessment.results.published:${sessionId}`,
  });

  revalidate();
  return {
    success: true,
    message: "Marks published — visible to parents/students.",
    sessionId,
  };
}

/** Lock freezes teacher edits (Admin/HOD). Also ensures visibility if not yet published. */
export async function lockMarkSessionAction(
  sessionId: string,
): Promise<AssessmentOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.results.publish");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const session = await loadSession(supabase, schoolId, sessionId);
  if (!session) {
    return { success: false, error: "Mark session not found." };
  }
  if (session.workflow_status === "locked" || session.locked_at) {
    return { success: true, message: "Already locked.", sessionId };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("assessment_mark_sessions")
    .update({
      workflow_status: "locked",
      locked_at: now,
      locked_by: actorId,
      published_at: session.published_at ?? now,
      published_by: session.published_by ?? actorId,
      updated_at: now,
    })
    .eq("id", sessionId);

  if (error) {
    return { success: false, error: error.message };
  }

  await syncResultsWorkflow(supabase, sessionId, "locked", actorId);
  await writeAssessmentAudit(supabase, {
    schoolId,
    action: "session.lock",
    actorId,
    markSessionId: sessionId,
    examDefinitionId: session.exam_definition_id,
    oldValues: { workflow_status: session.workflow_status },
    newValues: { workflow_status: "locked" },
  });

  revalidate();
  return {
    success: true,
    message: "Marks locked — teachers can no longer edit.",
    sessionId,
  };
}

/** Admin unlock back to published (editable) or draft. */
export async function unlockMarkSessionAction(
  sessionId: string,
  targetStatus: "draft" | "published" = "published",
): Promise<AssessmentOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.results.publish");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const session = await loadSession(supabase, schoolId, sessionId);
  if (!session) {
    return { success: false, error: "Mark session not found." };
  }
  if (session.workflow_status !== "locked" && !session.locked_at) {
    return { success: false, error: "Session is not locked." };
  }

  const now = new Date().toISOString();
  const vis = visibilityForMarksWorkflow(targetStatus);
  const { error } = await supabase
    .from("assessment_mark_sessions")
    .update({
      workflow_status: targetStatus,
      locked_at: null,
      locked_by: null,
      published_at:
        targetStatus === "published" ? (session.published_at ?? now) : null,
      updated_at: now,
    })
    .eq("id", sessionId);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase
    .from("exam_results")
    .update({
      workflow_status: targetStatus,
      locked_at: null,
      locked_by: null,
      published_at:
        targetStatus === "published" ? (session.published_at ?? now) : null,
      updated_at: now,
      ...vis,
    })
    .eq("mark_session_id", sessionId)
    .is("superseded_at", null);

  await writeAssessmentAudit(supabase, {
    schoolId,
    action: "session.unlock",
    actorId,
    markSessionId: sessionId,
    examDefinitionId: session.exam_definition_id,
    oldValues: { workflow_status: "locked" },
    newValues: { workflow_status: targetStatus },
  });

  revalidate();
  return {
    success: true,
    message: `Marks unlocked to ${targetStatus}.`,
    sessionId,
  };
}
