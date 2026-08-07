"use server";

import { revalidatePath } from "next/cache";
import {
  assertEmploymentOwned,
  assertStudentInSchool,
  assertYearOwned,
  getActorId,
  loadIncident,
  resolvePlacement,
  writeBehaviourAudit,
} from "@/lib/behaviour/server-helpers";
import type {
  BehaviourActionResult,
  CreateRemarkInput,
  UpdateRemarkInput,
} from "@/lib/behaviour/types";
import {
  defaultSeverityForKind,
  validateCreateRemarkInput,
  validateUpdateRemarkInput,
  visibilityFlags,
} from "@/lib/behaviour/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/behaviour");
  revalidatePath("/dashboard/teacher");
}

export async function createBehaviourRemarkAction(
  input: CreateRemarkInput,
): Promise<BehaviourActionResult> {
  const context = await getAuthenticatedSchoolContext("conduct.incident.record");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateCreateRemarkInput(input);
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
  if (
    input.employmentId &&
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const placement = await resolvePlacement(
    supabase,
    schoolId,
    input.studentProfileId,
    input.academicYearId,
  );

  const visibility = input.visibility ?? "staff";
  const vis = visibilityFlags(visibility);
  const severity =
    input.severity ?? defaultSeverityForKind(input.remarkKind);
  const followUpRequired = Boolean(input.followUpRequired);
  const recordedAt = input.recordedAt ?? new Date().toISOString();
  const body = input.body ?? input.description ?? null;

  const { data: row, error } = await supabase
    .from("conduct_incidents")
    .insert({
      school_id: schoolId,
      student_profile_id: input.studentProfileId,
      academic_year_id: input.academicYearId,
      student_academic_year_id: placement?.studentAcademicYearId ?? null,
      class_id: input.classId ?? placement?.classId ?? null,
      section_id: input.sectionId ?? placement?.sectionId ?? null,
      remark_kind: input.remarkKind,
      visibility,
      title: input.title.trim(),
      body,
      description: input.description ?? body,
      category: input.category ?? input.remarkKind,
      severity,
      status: input.status ?? "open",
      occurred_on: input.occurredOn ?? recordedAt.slice(0, 10),
      recorded_at: recordedAt,
      recorded_by: actorId,
      recorded_by_employment_id: input.employmentId ?? null,
      follow_up_required: followUpRequired,
      follow_up_status: followUpRequired ? "pending" : "none",
      attachment_media_ids: input.attachmentMediaIds ?? [],
      ...vis,
    })
    .select("id")
    .maybeSingle();

  if (error || !row) {
    return {
      success: false,
      error: error?.message ?? "Failed to create remark.",
    };
  }

  await writeBehaviourAudit(supabase, {
    schoolId,
    action: "remark.created",
    actorId,
    conductIncidentId: row.id,
    studentProfileId: input.studentProfileId,
    newValues: {
      remark_kind: input.remarkKind,
      visibility,
      recorded_at: recordedAt,
    },
  });

  const { emitDomainEvent } = await import("@/lib/domain-events/emit");
  await emitDomainEvent(supabase, {
    schoolId,
    eventType: "conduct.incident.recorded",
    aggregateType: "conduct_incident",
    aggregateId: row.id,
    payload: {
      studentProfileId: input.studentProfileId,
      visibility,
      title: input.title.trim(),
      body,
      description: input.description ?? body,
      remarkKind: input.remarkKind,
    },
    idempotencyKey: `conduct.incident:${row.id}`,
  });

  revalidate();
  return {
    success: true,
    message: "Behaviour remark recorded.",
    id: row.id,
  };
}

export async function updateBehaviourRemarkAction(
  input: UpdateRemarkInput,
): Promise<BehaviourActionResult> {
  const context = await getAuthenticatedSchoolContext("conduct.incident.record");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateUpdateRemarkInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const existing = await loadIncident(supabase, schoolId, input.id);
  if (!existing) {
    return { success: false, error: "Remark not found." };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.body !== undefined) {
    patch.body = input.body;
    if (input.description === undefined) patch.description = input.body;
  }
  if (input.description !== undefined) patch.description = input.description;
  if (input.category !== undefined) patch.category = input.category;
  if (input.severity !== undefined) patch.severity = input.severity;
  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === "resolved" || input.status === "dismissed") {
      patch.resolved_at = new Date().toISOString();
    }
  }
  if (input.occurredOn !== undefined) patch.occurred_on = input.occurredOn;
  if (input.followUpRequired !== undefined) {
    patch.follow_up_required = input.followUpRequired;
    if (input.followUpRequired && existing.follow_up_status === "none") {
      patch.follow_up_status = "pending";
    }
  }
  if (input.followUpStatus !== undefined) {
    patch.follow_up_status = input.followUpStatus;
  }
  if (input.visibility !== undefined) {
    patch.visibility = input.visibility;
    Object.assign(patch, visibilityFlags(input.visibility));
  }

  const { error } = await supabase
    .from("conduct_incidents")
    .update(patch)
    .eq("id", input.id);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeBehaviourAudit(supabase, {
    schoolId,
    action: "remark.updated",
    actorId,
    conductIncidentId: input.id,
    studentProfileId: existing.student_profile_id,
    oldValues: {
      status: existing.status,
      visibility: existing.visibility,
    },
    newValues: patch,
  });

  revalidate();
  return { success: true, message: "Remark updated.", id: input.id };
}

export async function archiveBehaviourRemarkAction(
  remarkId: string,
): Promise<BehaviourActionResult> {
  const context = await getAuthenticatedSchoolContext("conduct.incident.record");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const existing = await loadIncident(supabase, schoolId, remarkId);
  if (!existing) {
    return { success: false, error: "Remark not found." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("conduct_incidents")
    .update({ archived_at: now, updated_at: now })
    .eq("id", remarkId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeBehaviourAudit(supabase, {
    schoolId,
    action: "remark.archived",
    actorId,
    conductIncidentId: remarkId,
    studentProfileId: existing.student_profile_id,
  });

  revalidate();
  return { success: true, message: "Remark archived.", id: remarkId };
}

/** Set parent/school visibility explicitly (also updates visibility enum). */
export async function setRemarkVisibilityAction(input: {
  id: string;
  visibility: "private" | "staff" | "parent_visible" | "school";
}): Promise<BehaviourActionResult> {
  return updateBehaviourRemarkAction({
    id: input.id,
    visibility: input.visibility,
  });
}
