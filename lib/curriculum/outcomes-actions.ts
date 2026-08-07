"use server";

import { writeCurriculumAudit } from "@/lib/curriculum/audit";
import {
  assertCurriculumOwned,
  getActorId,
} from "@/lib/curriculum/server-helpers";
import type {
  CompetencyInput,
  CurriculumActionResult,
  LearningOutcomeInput,
} from "@/lib/curriculum/types";
import {
  validateCompetencyInput,
  validateLearningOutcomeInput,
} from "@/lib/curriculum/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function upsertLearningOutcomeAction(
  input: LearningOutcomeInput & { id?: string },
): Promise<CurriculumActionResult> {
  const fieldErrors = validateLearningOutcomeInput(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext(
    "curriculum.outcome.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertCurriculumOwned(
    supabase,
    schoolId,
    input.curriculumId,
  );
  if (!owned.ok) return { success: false, error: "Curriculum not found" };

  const actorId = await getActorId(supabase);
  const row = {
    school_id: schoolId,
    curriculum_id: input.curriculumId,
    statement: input.statement.trim(),
    code: input.code?.trim() || null,
    bloom_level: input.bloomLevel?.trim() || null,
    display_order: input.displayOrder ?? 0,
    unit_id: input.unitId ?? null,
    chapter_id: input.chapterId ?? null,
    topic_id: input.topicId ?? null,
    subtopic_id: input.subtopicId ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("curriculum_learning_outcomes")
      .update(row)
      .eq("id", input.id)
      .eq("school_id", schoolId);
    if (error) return { success: false, error: error.message };
    await writeCurriculumAudit(supabase, {
      schoolId,
      action: "outcome.update",
      entityType: "learning_outcome",
      entityId: input.id,
      actorAuthUserId: actorId,
      newValues: row,
    });
    return { success: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("curriculum_learning_outcomes")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data?.id) return { success: false, error: "Insert failed" };

  await writeCurriculumAudit(supabase, {
    schoolId,
    action: "outcome.create",
    entityType: "learning_outcome",
    entityId: data.id,
    actorAuthUserId: actorId,
    newValues: row,
  });
  return { success: true, id: data.id };
}

export async function archiveLearningOutcomeAction(
  outcomeId: string,
): Promise<CurriculumActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "curriculum.outcome.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("curriculum_learning_outcomes")
    .update({ archived_at: now, updated_at: now })
    .eq("id", outcomeId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };

  await writeCurriculumAudit(supabase, {
    schoolId,
    action: "outcome.archive",
    entityType: "learning_outcome",
    entityId: outcomeId,
    actorAuthUserId: actorId,
  });
  return { success: true, id: outcomeId };
}

export async function upsertCompetencyAction(
  input: CompetencyInput & { id?: string },
): Promise<CurriculumActionResult> {
  const fieldErrors = validateCompetencyInput(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext(
    "curriculum.outcome.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertCurriculumOwned(
    supabase,
    schoolId,
    input.curriculumId,
  );
  if (!owned.ok) return { success: false, error: "Curriculum not found" };

  const actorId = await getActorId(supabase);
  const row = {
    school_id: schoolId,
    curriculum_id: input.curriculumId,
    name: input.name.trim(),
    code: input.code?.trim() || null,
    framework: input.framework?.trim() || null,
    description: input.description?.trim() || null,
    display_order: input.displayOrder ?? 0,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("curriculum_competencies")
      .update(row)
      .eq("id", input.id)
      .eq("school_id", schoolId);
    if (error) return { success: false, error: error.message };
    return { success: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("curriculum_competencies")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data?.id) return { success: false, error: "Insert failed" };

  await writeCurriculumAudit(supabase, {
    schoolId,
    action: "competency.create",
    entityType: "competency",
    entityId: data.id,
    actorAuthUserId: actorId,
    newValues: row,
  });
  return { success: true, id: data.id };
}

export async function linkOutcomeCompetencyAction(
  curriculumId: string,
  learningOutcomeId: string,
  competencyId: string,
): Promise<CurriculumActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "curriculum.outcome.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertCurriculumOwned(supabase, schoolId, curriculumId);
  if (!owned.ok) return { success: false, error: "Curriculum not found" };

  const { data, error } = await supabase
    .from("curriculum_outcome_competencies")
    .insert({
      school_id: schoolId,
      curriculum_id: curriculumId,
      learning_outcome_id: learningOutcomeId,
      competency_id: competencyId,
    })
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  return { success: true, id: data?.id };
}

export async function unlinkOutcomeCompetencyAction(
  linkId: string,
): Promise<CurriculumActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "curriculum.outcome.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("curriculum_outcome_competencies")
    .update({ archived_at: now })
    .eq("id", linkId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };

  await writeCurriculumAudit(supabase, {
    schoolId,
    action: "outcome_competency.unlink",
    entityType: "outcome_competency",
    entityId: linkId,
    actorAuthUserId: actorId,
  });
  return { success: true, id: linkId };
}
