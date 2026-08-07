"use server";

import { revalidatePath } from "next/cache";
import {
  assertStudentInSchool,
  getActorId,
  writeAchievementAudit,
} from "@/lib/achievements/server-helpers";
import type {
  AchievementActionResult,
  QueueAchievementAiSummaryInput,
} from "@/lib/achievements/types";
import { validateQueueAiSummaryInput } from "@/lib/achievements/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

/**
 * FUTURE: queue AI summary over achievement timeline.
 * v1 persists stub only — no LLM / provider calls.
 */
export async function queueAchievementAiSummaryAction(
  input: QueueAchievementAiSummaryInput,
): Promise<AchievementActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "student_achievement.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateQueueAiSummaryInput(input);
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

  let achievementIds = input.achievementIds ?? [];
  if (achievementIds.length === 0) {
    let q = supabase
      .from("student_achievements")
      .select("id")
      .eq("school_id", schoolId)
      .eq("student_profile_id", input.studentProfileId)
      .is("archived_at", null)
      .limit(200);
    if (input.academicYearId) {
      q = q.eq("academic_year_id", input.academicYearId);
    }
    const { data } = await q;
    achievementIds = (data ?? []).map((r) => r.id as string);
  }

  const fingerprint = [
    input.studentProfileId,
    input.academicYearId ?? "",
    [...achievementIds].sort().join(","),
  ].join("|");

  const { data, error } = await supabase
    .from("student_achievement_ai_summaries")
    .insert({
      school_id: schoolId,
      student_profile_id: input.studentProfileId,
      academic_year_id: input.academicYearId ?? null,
      status: "queued",
      prompt_fingerprint: fingerprint,
      input_achievement_ids: achievementIds,
      requested_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to queue AI summary stub.",
    };
  }

  await writeAchievementAudit(supabase, {
    schoolId,
    action: "ai_summary.queued",
    actorId,
    studentProfileId: input.studentProfileId,
    newValues: {
      summary_id: data.id,
      achievement_count: achievementIds.length,
    },
  });

  revalidatePath("/dashboard/achievements");
  return {
    success: true,
    message:
      "AI summary queued (stub — no provider call). Achievement facts unchanged.",
    id: data.id,
  };
}

export async function listAchievementAiSummariesAction(input: {
  studentProfileId: string;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "student_achievement.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data, error } = await supabase
    .from("student_achievement_ai_summaries")
    .select(
      "id, status, academic_year_id, prompt_fingerprint, input_achievement_ids, summary_text, model_id, error_message, completed_at, created_at",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}
