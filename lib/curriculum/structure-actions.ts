"use server";

import { writeCurriculumAudit } from "@/lib/curriculum/audit";
import { ensureNodeCode } from "@/lib/curriculum/codes";
import {
  assertCurriculumOwned,
  getActorId,
} from "@/lib/curriculum/server-helpers";
import type {
  CurriculumActionResult,
  StructureNodeInput,
  StructureNodeKind,
} from "@/lib/curriculum/types";
import { validateStructureNodeInput } from "@/lib/curriculum/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

const TABLE_BY_KIND: Record<StructureNodeKind, string> = {
  unit: "curriculum_units",
  chapter: "curriculum_chapters",
  topic: "curriculum_topics",
  subtopic: "curriculum_subtopics",
};

export async function createStructureNodeAction(
  kind: StructureNodeKind,
  input: StructureNodeInput,
): Promise<CurriculumActionResult> {
  const fieldErrors = validateStructureNodeInput(kind, input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext(
    "curriculum.structure.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertCurriculumOwned(
    supabase,
    schoolId,
    input.curriculumId,
  );
  if (!owned.ok) return { success: false, error: "Curriculum not found" };
  if (owned.status === "retired") {
    return { success: false, error: "Cannot edit retired curriculum" };
  }

  const actorId = await getActorId(supabase);
  const table = TABLE_BY_KIND[kind];
  const base = {
    school_id: schoolId,
    curriculum_id: input.curriculumId,
    code: ensureNodeCode(input.title, input.code),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    suggested_hours: input.suggestedHours ?? null,
    display_order: input.displayOrder ?? 0,
  };

  let row: Record<string, unknown> = { ...base };
  if (kind === "chapter") {
    row = { ...row, unit_id: input.unitId, textbook_ref: input.textbookRef ?? null };
  } else if (kind === "topic") {
    row = { ...row, chapter_id: input.chapterId };
  } else if (kind === "subtopic") {
    row = { ...row, topic_id: input.topicId };
  }

  const { data, error } = await supabase
    .from(table)
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data?.id) return { success: false, error: "Insert failed" };

  await writeCurriculumAudit(supabase, {
    schoolId,
    action: "structure.create",
    entityType: kind,
    entityId: data.id,
    actorAuthUserId: actorId,
    newValues: row,
  });

  return { success: true, id: data.id };
}

export async function updateStructureNodeAction(
  kind: StructureNodeKind,
  nodeId: string,
  patch: Partial<StructureNodeInput>,
): Promise<CurriculumActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "curriculum.structure.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const table = TABLE_BY_KIND[kind];

  const { data: existing } = await supabase
    .from(table)
    .select("id, curriculum_id, title")
    .eq("id", nodeId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!existing) return { success: false, error: "Node not found" };

  const owned = await assertCurriculumOwned(
    supabase,
    schoolId,
    existing.curriculum_id,
  );
  if (!owned.ok) return { success: false, error: "Curriculum not found" };
  if (owned.status === "retired") {
    return { success: false, error: "Cannot edit retired curriculum" };
  }

  if (
    patch.suggestedHours != null &&
    patch.suggestedHours < 0
  ) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: { suggestedHours: "Must be ≥ 0" },
    };
  }

  const actorId = await getActorId(supabase);
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title != null) update.title = patch.title.trim();
  if (patch.description !== undefined) {
    update.description = patch.description?.trim() || null;
  }
  if (patch.code !== undefined) {
    update.code = ensureNodeCode(
      patch.title ?? existing.title,
      patch.code,
    );
  }
  if (patch.suggestedHours !== undefined) {
    update.suggested_hours = patch.suggestedHours;
  }
  if (patch.displayOrder !== undefined) {
    update.display_order = patch.displayOrder;
  }
  if (kind === "chapter" && patch.textbookRef !== undefined) {
    update.textbook_ref = patch.textbookRef;
  }

  const { error } = await supabase
    .from(table)
    .update(update)
    .eq("id", nodeId)
    .eq("school_id", schoolId);

  if (error) return { success: false, error: error.message };

  await writeCurriculumAudit(supabase, {
    schoolId,
    action: "structure.update",
    entityType: kind,
    entityId: nodeId,
    actorAuthUserId: actorId,
    newValues: update,
  });

  return { success: true, id: nodeId };
}

export async function archiveStructureNodeAction(
  kind: StructureNodeKind,
  nodeId: string,
): Promise<CurriculumActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "curriculum.structure.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const table = TABLE_BY_KIND[kind];
  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from(table)
    .select("id, curriculum_id")
    .eq("id", nodeId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!existing) return { success: false, error: "Node not found" };

  const { error } = await supabase
    .from(table)
    .update({ archived_at: now, updated_at: now })
    .eq("id", nodeId)
    .eq("school_id", schoolId);

  if (error) return { success: false, error: error.message };

  await writeCurriculumAudit(supabase, {
    schoolId,
    action: "structure.archive",
    entityType: kind,
    entityId: nodeId,
    actorAuthUserId: actorId,
  });

  return { success: true, id: nodeId };
}

export async function reorderStructureNodesAction(
  kind: StructureNodeKind,
  curriculumId: string,
  orderedIds: string[],
): Promise<CurriculumActionResult> {
  if (!orderedIds.length) {
    return { success: false, error: "No nodes to reorder" };
  }

  const context = await getAuthenticatedSchoolContext(
    "curriculum.structure.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertCurriculumOwned(supabase, schoolId, curriculumId);
  if (!owned.ok) return { success: false, error: "Curriculum not found" };

  const table = TABLE_BY_KIND[kind];
  const actorId = await getActorId(supabase);

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from(table)
      .update({ display_order: i, updated_at: new Date().toISOString() })
      .eq("id", orderedIds[i])
      .eq("curriculum_id", curriculumId)
      .eq("school_id", schoolId);
    if (error) return { success: false, error: error.message };
  }

  await writeCurriculumAudit(supabase, {
    schoolId,
    action: "structure.reorder",
    entityType: kind,
    entityId: curriculumId,
    actorAuthUserId: actorId,
    newValues: { orderedIds },
  });

  return { success: true, id: curriculumId };
}
