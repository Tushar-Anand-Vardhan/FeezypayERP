"use server";

import { revalidatePath } from "next/cache";
import {
  assertStudentInSchool,
  assertYearOwned,
  getActorId,
  loadAchievement,
  upsertAchievementFromParticipant,
  writeAchievementAudit,
} from "@/lib/achievements/server-helpers";
import type {
  AchievementActionResult,
  RecordFromEventInput,
  RecordManualAchievementInput,
  UpdateAchievementOutcomesInput,
} from "@/lib/achievements/types";
import {
  validateManualAchievementInput,
  validateRecordFromEventInput,
  validateUpdateOutcomesInput,
  visibilityFlags,
} from "@/lib/achievements/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/achievements");
  revalidatePath("/dashboard/student");
  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/events");
}

export async function recordAchievementFromEventAction(
  input: RecordFromEventInput,
): Promise<AchievementActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "student_achievement.record",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateRecordFromEventInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const result = await upsertAchievementFromParticipant(supabase, {
    schoolId,
    actorId,
    eventParticipantId: input.eventParticipantId,
    points: input.points,
    remarks: input.remarks,
    visibility: input.visibility,
    photoMediaIds: input.photoMediaIds,
    attachmentMediaIds: input.attachmentMediaIds,
    employmentId: input.employmentId,
  });

  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const row = await loadAchievement(supabase, schoolId, result.id);
  await writeAchievementAudit(supabase, {
    schoolId,
    action: "achievement.from_event",
    actorId,
    achievementId: result.id,
    studentProfileId: (row?.student_profile_id as string) ?? null,
    calendarEventId: (row?.calendar_event_id as string) ?? null,
  });

  revalidate();
  return {
    success: true,
    message: "Achievement projected from calendar activity.",
    id: result.id,
  };
}

export async function syncAchievementsFromEventAction(
  calendarEventId: string,
): Promise<AchievementActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "student_achievement.record",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const { data: participants } = await supabase
    .from("event_participants")
    .select("id")
    .eq("school_id", schoolId)
    .eq("calendar_event_id", calendarEventId)
    .is("archived_at", null)
    .limit(500);

  const ids: string[] = [];
  for (const p of participants ?? []) {
    const result = await upsertAchievementFromParticipant(supabase, {
      schoolId,
      actorId,
      eventParticipantId: p.id as string,
    });
    if ("id" in result) {
      ids.push(result.id);
    }
  }

  await writeAchievementAudit(supabase, {
    schoolId,
    action: "achievement.event_synced",
    actorId,
    calendarEventId,
    newValues: { count: ids.length },
  });

  revalidate();
  return {
    success: true,
    message: `Synced ${ids.length} achievement(s) from event.`,
    ids,
  };
}

export async function recordManualAchievementAction(
  input: RecordManualAchievementInput,
): Promise<AchievementActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "student_achievement.record",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateManualAchievementInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  if (
    !(await assertStudentInSchool(supabase, schoolId, input.studentProfileId))
  ) {
    return { success: false, error: "Student not found in this school." };
  }
  if (
    input.academicYearId &&
    !(await assertYearOwned(supabase, schoolId, input.academicYearId))
  ) {
    return { success: false, error: "Academic year not found." };
  }

  const visibility = input.visibility ?? "school";
  const vis = visibilityFlags(visibility);

  const { data, error } = await supabase
    .from("student_achievements")
    .insert({
      school_id: schoolId,
      student_profile_id: input.studentProfileId,
      academic_year_id: input.academicYearId ?? null,
      term_id: input.termId ?? null,
      title: input.title.trim(),
      category: input.category?.trim() || "other",
      awarded_on: input.awardedOn ?? null,
      description: input.description?.trim() || null,
      source: "manual",
      participation_role: input.participationRole ?? null,
      attendance_status: input.attendanceStatus ?? null,
      award_label: input.awardLabel ?? null,
      position_label: input.positionLabel ?? null,
      certificate_status: input.certificateStatus ?? "none",
      certificate_document_id: input.certificateDocumentId ?? null,
      points: input.points ?? null,
      remarks: input.remarks ?? null,
      photo_media_ids: input.photoMediaIds ?? [],
      attachment_media_ids: input.attachmentMediaIds ?? [],
      evidence_media_ids: input.attachmentMediaIds ?? [],
      visibility,
      ...vis,
      recorded_by: actorId,
      recorded_by_employment_id: input.employmentId ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to record achievement.",
    };
  }

  await writeAchievementAudit(supabase, {
    schoolId,
    action: "achievement.manual_recorded",
    actorId,
    achievementId: data.id,
    studentProfileId: input.studentProfileId,
  });

  revalidate();
  return {
    success: true,
    message: "Manual achievement recorded.",
    id: data.id,
  };
}

export async function updateAchievementOutcomesAction(
  input: UpdateAchievementOutcomesInput,
): Promise<AchievementActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "student_achievement.record",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateUpdateOutcomesInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const row = await loadAchievement(supabase, schoolId, input.achievementId);
  if (!row || row.archived_at) {
    return { success: false, error: "Achievement not found." };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.participationRole !== undefined) {
    patch.participation_role = input.participationRole;
  }
  if (input.attendanceStatus !== undefined) {
    patch.attendance_status = input.attendanceStatus;
  }
  if (input.awardLabel !== undefined) patch.award_label = input.awardLabel;
  if (input.positionLabel !== undefined) {
    patch.position_label = input.positionLabel;
  }
  if (input.certificateStatus !== undefined) {
    patch.certificate_status = input.certificateStatus;
  }
  if (input.certificateDocumentId !== undefined) {
    patch.certificate_document_id = input.certificateDocumentId;
  }
  if (input.points !== undefined) patch.points = input.points;
  if (input.remarks !== undefined) patch.remarks = input.remarks;
  if (input.awardedOn !== undefined) patch.awarded_on = input.awardedOn;
  if (input.description !== undefined) patch.description = input.description;
  if (input.category !== undefined) patch.category = input.category;
  if (input.photoMediaIds !== undefined) {
    patch.photo_media_ids = input.photoMediaIds;
  }
  if (input.attachmentMediaIds !== undefined) {
    patch.attachment_media_ids = input.attachmentMediaIds;
    patch.evidence_media_ids = input.attachmentMediaIds;
  }
  if (input.visibility !== undefined) {
    patch.visibility = input.visibility;
    Object.assign(patch, visibilityFlags(input.visibility));
  }

  const { error } = await supabase
    .from("student_achievements")
    .update(patch)
    .eq("id", input.achievementId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeAchievementAudit(supabase, {
    schoolId,
    action: "achievement.outcomes_updated",
    actorId,
    achievementId: input.achievementId,
    studentProfileId: row.student_profile_id as string,
    calendarEventId: (row.calendar_event_id as string) ?? null,
    newValues: patch,
  });

  revalidate();
  return {
    success: true,
    message: "Achievement outcomes updated.",
    id: input.achievementId,
  };
}

export async function archiveStudentAchievementAction(
  achievementId: string,
): Promise<AchievementActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "student_achievement.archive",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const row = await loadAchievement(supabase, schoolId, achievementId);
  if (!row || row.archived_at) {
    return { success: false, error: "Achievement not found." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("student_achievements")
    .update({ archived_at: now, archived_by: actorId, updated_at: now })
    .eq("id", achievementId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeAchievementAudit(supabase, {
    schoolId,
    action: "achievement.archived",
    actorId,
    achievementId,
    studentProfileId: row.student_profile_id as string,
  });

  revalidate();
  return { success: true, message: "Achievement archived.", id: achievementId };
}
