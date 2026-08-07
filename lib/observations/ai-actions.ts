"use server";

import { revalidatePath } from "next/cache";
import {
  assertStudentInSchool,
  assertYearOwned,
  getActorId,
  writeObservationAudit,
} from "@/lib/observations/server-helpers";
import type {
  ObservationActionResult,
  QueueAiSummaryInput,
} from "@/lib/observations/types";
import { validateQueueAiSummaryInput } from "@/lib/observations/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

/**
 * FUTURE: queue an AI summary job over observation ids.
 * v1 persists a stub row only — no LLM / provider calls.
 */
export async function queueObservationAiSummaryAction(
  input: QueueAiSummaryInput,
): Promise<ObservationActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "student_observation.read",
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

  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }
  if (
    !(await assertStudentInSchool(supabase, schoolId, input.studentProfileId))
  ) {
    return { success: false, error: "Student not found in this school." };
  }

  let observationIds = input.observationIds ?? [];
  if (observationIds.length === 0) {
    let q = supabase
      .from("student_observations")
      .select("id")
      .eq("school_id", schoolId)
      .eq("student_profile_id", input.studentProfileId)
      .eq("academic_year_id", input.academicYearId)
      .is("archived_at", null)
      .limit(200);
    if (input.termId) {
      q = q.eq("term_id", input.termId);
    }
    if (input.categoryCode) {
      q = q.eq("category_code", input.categoryCode);
    }
    const { data } = await q;
    observationIds = (data ?? []).map((r) => r.id as string);
  }

  const fingerprint = [
    input.studentProfileId,
    input.academicYearId,
    input.termId ?? "",
    input.categoryCode ?? "",
    [...observationIds].sort().join(","),
  ].join("|");

  const { data, error } = await supabase
    .from("student_observation_ai_summaries")
    .insert({
      school_id: schoolId,
      student_profile_id: input.studentProfileId,
      academic_year_id: input.academicYearId,
      term_id: input.termId ?? null,
      category_code: input.categoryCode ?? null,
      status: "queued",
      prompt_fingerprint: fingerprint,
      input_observation_ids: observationIds,
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

  await writeObservationAudit(supabase, {
    schoolId,
    action: "ai_summary.queued",
    actorId,
    studentProfileId: input.studentProfileId,
    newValues: {
      summary_id: data.id,
      observation_count: observationIds.length,
    },
  });

  revalidatePath("/dashboard/observations");
  return {
    success: true,
    message:
      "AI summary queued (stub — no provider call). Observation facts unchanged.",
    id: data.id,
  };
}

export async function listObservationAiSummariesAction(input: {
  studentProfileId: string;
  academicYearId: string;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "student_observation.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data, error } = await supabase
    .from("student_observation_ai_summaries")
    .select(
      "id, status, category_code, term_id, prompt_fingerprint, input_observation_ids, summary_text, model_id, error_message, completed_at, created_at",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .eq("academic_year_id", input.academicYearId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}
