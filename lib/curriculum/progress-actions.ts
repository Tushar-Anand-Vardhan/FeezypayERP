"use server";

import { writeCurriculumAudit } from "@/lib/curriculum/audit";
import {
  assertCurriculumOwned,
  getActorId,
} from "@/lib/curriculum/server-helpers";
import type {
  CurriculumActionResult,
  ProgressInput,
} from "@/lib/curriculum/types";
import { validateProgressInput } from "@/lib/curriculum/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function upsertProgressAction(
  input: ProgressInput,
): Promise<CurriculumActionResult> {
  const fieldErrors = validateProgressInput(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext(
    "curriculum.progress.record",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertCurriculumOwned(
    supabase,
    schoolId,
    input.curriculumId,
  );
  if (!owned.ok) return { success: false, error: "Curriculum not found" };

  const { data: version } = await supabase
    .from("curriculum_versions")
    .select("id, curriculum_id")
    .eq("id", input.curriculumVersionId)
    .eq("curriculum_id", input.curriculumId)
    .maybeSingle();
  if (!version) {
    return { success: false, error: "Curriculum version not found" };
  }

  const actorId = await getActorId(supabase);
  const completedAt =
    input.status === "completed" ? new Date().toISOString() : null;

  const { data: existing } = await supabase
    .from("curriculum_topic_progress")
    .select("id")
    .eq("section_id", input.sectionId)
    .eq("curriculum_version_id", input.curriculumVersionId)
    .eq("node_type", input.nodeType)
    .eq("node_id", input.nodeId)
    .eq("employment_id", input.employmentId)
    .is("archived_at", null)
    .maybeSingle();

  const row = {
    school_id: schoolId,
    curriculum_id: input.curriculumId,
    curriculum_version_id: input.curriculumVersionId,
    section_id: input.sectionId,
    employment_id: input.employmentId,
    node_type: input.nodeType,
    node_id: input.nodeId,
    status: input.status,
    completion_pct: input.completionPct ?? null,
    completed_at: completedAt,
    teaching_notes: input.teachingNotes ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("curriculum_topic_progress")
      .update(row)
      .eq("id", existing.id)
      .eq("school_id", schoolId);
    if (error) return { success: false, error: error.message };

    await writeCurriculumAudit(supabase, {
      schoolId,
      action: "progress.update",
      entityType: "topic_progress",
      entityId: existing.id,
      actorAuthUserId: actorId,
      newValues: { status: input.status, node_type: input.nodeType },
    });
    return { success: true, id: existing.id };
  }

  const { data, error } = await supabase
    .from("curriculum_topic_progress")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data?.id) return { success: false, error: "Insert failed" };

  await writeCurriculumAudit(supabase, {
    schoolId,
    action: "progress.create",
    entityType: "topic_progress",
    entityId: data.id,
    actorAuthUserId: actorId,
    newValues: { status: input.status },
  });
  return { success: true, id: data.id };
}

export async function listProgressBySectionAction(options: {
  curriculumVersionId: string;
  sectionId: string;
  employmentId?: string;
}): Promise<
  | { success: true; progress: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "curriculum.progress.read",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  let query = supabase
    .from("curriculum_topic_progress")
    .select("*")
    .eq("school_id", schoolId)
    .eq("curriculum_version_id", options.curriculumVersionId)
    .eq("section_id", options.sectionId)
    .is("archived_at", null);

  if (options.employmentId) {
    query = query.eq("employment_id", options.employmentId);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, progress: data ?? [] };
}
