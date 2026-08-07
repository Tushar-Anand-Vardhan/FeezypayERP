"use server";

import { revalidatePath } from "next/cache";
import {
  assertEmploymentOwned,
  getActorId,
  loadIncident,
  writeBehaviourAudit,
} from "@/lib/behaviour/server-helpers";
import type {
  BehaviourActionResult,
  CreateFollowUpInput,
  UpdateFollowUpInput,
} from "@/lib/behaviour/types";
import {
  validateCreateFollowUpInput,
  validateUpdateFollowUpInput,
} from "@/lib/behaviour/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/behaviour");
  revalidatePath("/dashboard/teacher");
}

export async function createBehaviourFollowUpAction(
  input: CreateFollowUpInput,
): Promise<BehaviourActionResult> {
  const context = await getAuthenticatedSchoolContext("conduct.incident.approve");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateCreateFollowUpInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const incident = await loadIncident(
    supabase,
    schoolId,
    input.conductIncidentId,
  );
  if (!incident) {
    return { success: false, error: "Remark/incident not found." };
  }
  if (
    input.assignedToEmploymentId &&
    !(await assertEmploymentOwned(
      supabase,
      schoolId,
      input.assignedToEmploymentId,
    ))
  ) {
    return { success: false, error: "Assignee employment not found." };
  }

  const recordedAt = new Date().toISOString();
  const { data: row, error } = await supabase
    .from("behaviour_follow_ups")
    .insert({
      school_id: schoolId,
      conduct_incident_id: input.conductIncidentId,
      action_type: input.actionType ?? "note",
      title: input.title.trim(),
      description: input.description ?? null,
      due_on: input.dueOn ?? null,
      assigned_to_employment_id: input.assignedToEmploymentId ?? null,
      status: "pending",
      created_by: actorId,
      recorded_at: recordedAt,
    })
    .select("id")
    .maybeSingle();

  if (error || !row) {
    return {
      success: false,
      error: error?.message ?? "Failed to create follow-up.",
    };
  }

  await supabase
    .from("conduct_incidents")
    .update({
      follow_up_required: true,
      follow_up_status:
        incident.follow_up_status === "completed"
          ? "in_progress"
          : incident.follow_up_status === "none"
            ? "pending"
            : incident.follow_up_status,
      updated_at: recordedAt,
    })
    .eq("id", input.conductIncidentId);

  await writeBehaviourAudit(supabase, {
    schoolId,
    action: "follow_up.created",
    actorId,
    conductIncidentId: input.conductIncidentId,
    followUpId: row.id,
    studentProfileId: incident.student_profile_id,
    newValues: { action_type: input.actionType ?? "note", recorded_at: recordedAt },
  });

  revalidate();
  return {
    success: true,
    message: "Follow-up action created.",
    id: row.id,
  };
}

export async function updateBehaviourFollowUpAction(
  input: UpdateFollowUpInput,
): Promise<BehaviourActionResult> {
  const context = await getAuthenticatedSchoolContext("conduct.incident.approve");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateUpdateFollowUpInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const { data: existing } = await supabase
    .from("behaviour_follow_ups")
    .select("*")
    .eq("id", input.id)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!existing) {
    return { success: false, error: "Follow-up not found." };
  }

  if (
    input.assignedToEmploymentId &&
    !(await assertEmploymentOwned(
      supabase,
      schoolId,
      input.assignedToEmploymentId,
    ))
  ) {
    return { success: false, error: "Assignee employment not found." };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (input.dueOn !== undefined) patch.due_on = input.dueOn;
  if (input.assignedToEmploymentId !== undefined) {
    patch.assigned_to_employment_id = input.assignedToEmploymentId;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === "completed") {
      patch.completed_at = now;
    }
  }

  const { error } = await supabase
    .from("behaviour_follow_ups")
    .update(patch)
    .eq("id", input.id);

  if (error) {
    return { success: false, error: error.message };
  }

  // Roll up parent incident follow_up_status
  const { data: siblings } = await supabase
    .from("behaviour_follow_ups")
    .select("status")
    .eq("conduct_incident_id", existing.conduct_incident_id)
    .is("archived_at", null);

  const statuses = (siblings ?? []).map((s) => s.status as string);
  let rollup: string = "pending";
  if (statuses.length === 0) {
    rollup = "none";
  } else if (statuses.every((s) => s === "completed" || s === "cancelled")) {
    rollup = statuses.every((s) => s === "cancelled") ? "cancelled" : "completed";
  } else if (statuses.some((s) => s === "in_progress" || s === "completed")) {
    rollup = "in_progress";
  }

  await supabase
    .from("conduct_incidents")
    .update({
      follow_up_status: rollup,
      follow_up_required: rollup !== "none" && rollup !== "completed",
      updated_at: now,
    })
    .eq("id", existing.conduct_incident_id);

  await writeBehaviourAudit(supabase, {
    schoolId,
    action: "follow_up.updated",
    actorId,
    conductIncidentId: existing.conduct_incident_id,
    followUpId: input.id,
    newValues: patch,
  });

  revalidate();
  return { success: true, message: "Follow-up updated.", id: input.id };
}

export async function archiveBehaviourFollowUpAction(
  followUpId: string,
): Promise<BehaviourActionResult> {
  const context = await getAuthenticatedSchoolContext("conduct.incident.approve");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data: existing } = await supabase
    .from("behaviour_follow_ups")
    .select("id, conduct_incident_id")
    .eq("id", followUpId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!existing) {
    return { success: false, error: "Follow-up not found." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("behaviour_follow_ups")
    .update({ archived_at: now, updated_at: now })
    .eq("id", followUpId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeBehaviourAudit(supabase, {
    schoolId,
    action: "follow_up.archived",
    actorId,
    conductIncidentId: existing.conduct_incident_id,
    followUpId,
  });

  revalidate();
  return { success: true, message: "Follow-up archived.", id: followUpId };
}
