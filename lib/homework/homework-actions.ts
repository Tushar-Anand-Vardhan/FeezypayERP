"use server";

import { revalidatePath } from "next/cache";
import {
  assertEmploymentOwned,
  assertSectionOwned,
  assertYearOwned,
  getActorId,
  loadHomework,
  writeHomeworkAudit,
} from "@/lib/homework/server-helpers";
import type {
  CreateHomeworkInput,
  HomeworkActionResult,
  UpdateHomeworkInput,
} from "@/lib/homework/types";
import {
  validateCreateHomeworkInput,
  validateUpdateHomeworkInput,
} from "@/lib/homework/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/homework");
  revalidatePath("/dashboard/teacher");
}

export async function createHomeworkAction(
  input: CreateHomeworkInput,
): Promise<HomeworkActionResult> {
  const context = await getAuthenticatedSchoolContext("homework.assign");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateCreateHomeworkInput(input);
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
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const section = await assertSectionOwned(
    supabase,
    schoolId,
    input.sectionId,
  );
  if (!section.ok) {
    return { success: false, error: "Section not found." };
  }

  const publishNow = Boolean(input.publishNow);
  const now = new Date().toISOString();
  const assignedOn = input.assignedOn ?? now.slice(0, 10);

  const { data: row, error } = await supabase
    .from("homework_assignments")
    .insert({
      school_id: schoolId,
      academic_year_id: input.academicYearId,
      employment_id: input.employmentId,
      section_id: input.sectionId,
      class_id: input.classId ?? section.classId,
      subject_id: input.subjectId ?? null,
      assignment_kind: input.assignmentKind,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      assigned_on: assignedOn,
      due_on: input.dueOn ?? null,
      due_at: input.dueAt ?? null,
      max_marks: input.maxMarks ?? null,
      allow_late: input.allowLate ?? true,
      late_until: input.lateUntil ?? null,
      attachment_media_ids: input.attachmentMediaIds ?? [],
      parent_visible: input.parentVisible ?? true,
      visible_to_students: input.visibleToStudents ?? true,
      ai_evaluation_enabled: input.aiEvaluationEnabled ?? false,
      ai_evaluation_status: input.aiEvaluationEnabled
        ? "disabled"
        : "none",
      status: publishNow ? "assigned" : "draft",
      published_at: publishNow ? now : null,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !row) {
    return {
      success: false,
      error: error?.message ?? "Failed to create homework.",
    };
  }

  await writeHomeworkAudit(supabase, {
    schoolId,
    action: publishNow ? "homework.published" : "homework.created",
    actorId,
    homeworkId: row.id,
    newValues: {
      assignment_kind: input.assignmentKind,
      status: publishNow ? "assigned" : "draft",
    },
  });

  if (publishNow) {
    const { emitDomainEvent } = await import("@/lib/domain-events/emit");
    await emitDomainEvent(supabase, {
      schoolId,
      eventType: "homework.assigned",
      aggregateType: "homework_assignment",
      aggregateId: row.id,
      payload: {
        title: input.title,
        sectionId: input.sectionId,
        academicYearId: input.academicYearId,
        dueAt: input.dueAt ?? null,
        visibleToParents: input.parentVisible ?? true,
      },
      idempotencyKey: `homework.assigned:${row.id}`,
    });
  }

  revalidate();
  return {
    success: true,
    message: publishNow ? "Homework published." : "Homework draft saved.",
    id: row.id,
  };
}

export async function updateHomeworkAction(
  input: UpdateHomeworkInput,
): Promise<HomeworkActionResult> {
  const context = await getAuthenticatedSchoolContext("homework.assign");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateUpdateHomeworkInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const existing = await loadHomework(supabase, schoolId, input.id);
  if (!existing) {
    return { success: false, error: "Homework not found." };
  }
  if (existing.status === "closed") {
    return {
      success: false,
      error: "Closed homework cannot be edited — reopen or create a new one.",
    };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.instructions !== undefined) {
    patch.instructions = input.instructions?.trim() || null;
  }
  if (input.subjectId !== undefined) patch.subject_id = input.subjectId;
  if (input.classId !== undefined) patch.class_id = input.classId;
  if (input.dueOn !== undefined) patch.due_on = input.dueOn;
  if (input.dueAt !== undefined) patch.due_at = input.dueAt;
  if (input.maxMarks !== undefined) patch.max_marks = input.maxMarks;
  if (input.allowLate !== undefined) patch.allow_late = input.allowLate;
  if (input.lateUntil !== undefined) patch.late_until = input.lateUntil;
  if (input.attachmentMediaIds !== undefined) {
    patch.attachment_media_ids = input.attachmentMediaIds;
  }
  if (input.parentVisible !== undefined) {
    patch.parent_visible = input.parentVisible;
  }
  if (input.visibleToStudents !== undefined) {
    patch.visible_to_students = input.visibleToStudents;
  }
  if (input.aiEvaluationEnabled !== undefined) {
    patch.ai_evaluation_enabled = input.aiEvaluationEnabled;
    patch.ai_evaluation_status = input.aiEvaluationEnabled
      ? "disabled"
      : "none";
  }

  const { error } = await supabase
    .from("homework_assignments")
    .update(patch)
    .eq("id", input.id);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeHomeworkAudit(supabase, {
    schoolId,
    action: "homework.updated",
    actorId,
    homeworkId: input.id,
    newValues: patch,
  });

  revalidate();
  return { success: true, message: "Homework updated.", id: input.id };
}

export async function publishHomeworkAction(
  homeworkId: string,
): Promise<HomeworkActionResult> {
  const context = await getAuthenticatedSchoolContext("homework.assign");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const existing = await loadHomework(supabase, schoolId, homeworkId);
  if (!existing) {
    return { success: false, error: "Homework not found." };
  }
  if (existing.status === "assigned") {
    return { success: true, message: "Already published.", id: homeworkId };
  }
  if (existing.status === "closed") {
    return { success: false, error: "Closed homework cannot be published." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("homework_assignments")
    .update({
      status: "assigned",
      published_at: now,
      updated_at: now,
    })
    .eq("id", homeworkId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeHomeworkAudit(supabase, {
    schoolId,
    action: "homework.published",
    actorId,
    homeworkId,
  });

  const { emitDomainEvent } = await import("@/lib/domain-events/emit");
  await emitDomainEvent(supabase, {
    schoolId,
    eventType: "homework.assigned",
    aggregateType: "homework_assignment",
    aggregateId: homeworkId,
    payload: {
      title: existing.title,
      sectionId: existing.section_id,
      academicYearId: existing.academic_year_id,
      dueAt: existing.due_at,
      visibleToParents: existing.parent_visible ?? true,
    },
    idempotencyKey: `homework.assigned:${homeworkId}`,
  });

  revalidate();
  return { success: true, message: "Homework published.", id: homeworkId };
}

export async function closeHomeworkAction(
  homeworkId: string,
): Promise<HomeworkActionResult> {
  const context = await getAuthenticatedSchoolContext("homework.assign");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const existing = await loadHomework(supabase, schoolId, homeworkId);
  if (!existing) {
    return { success: false, error: "Homework not found." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("homework_assignments")
    .update({
      status: "closed",
      closed_at: now,
      updated_at: now,
    })
    .eq("id", homeworkId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeHomeworkAudit(supabase, {
    schoolId,
    action: "homework.closed",
    actorId,
    homeworkId,
  });

  revalidate();
  return { success: true, message: "Homework closed.", id: homeworkId };
}

export async function archiveHomeworkAction(
  homeworkId: string,
): Promise<HomeworkActionResult> {
  const context = await getAuthenticatedSchoolContext("homework.assign");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("homework_assignments")
    .update({
      archived_at: now,
      updated_at: now,
    })
    .eq("id", homeworkId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeHomeworkAudit(supabase, {
    schoolId,
    action: "homework.archived",
    actorId,
    homeworkId,
  });

  revalidate();
  return { success: true, message: "Homework archived.", id: homeworkId };
}

export async function setHomeworkParentVisibilityAction(
  homeworkId: string,
  parentVisible: boolean,
): Promise<HomeworkActionResult> {
  const context = await getAuthenticatedSchoolContext("homework.assign");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const existing = await loadHomework(supabase, schoolId, homeworkId);
  if (!existing) {
    return { success: false, error: "Homework not found." };
  }

  const { error } = await supabase
    .from("homework_assignments")
    .update({
      parent_visible: parentVisible,
      updated_at: new Date().toISOString(),
    })
    .eq("id", homeworkId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeHomeworkAudit(supabase, {
    schoolId,
    action: "homework.parent_visibility",
    actorId,
    homeworkId,
    newValues: { parent_visible: parentVisible },
  });

  revalidate();
  return {
    success: true,
    message: parentVisible
      ? "Visible to parents."
      : "Hidden from parents.",
    id: homeworkId,
  };
}
