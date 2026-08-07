"use server";

import { writeCurriculumAudit } from "@/lib/curriculum/audit";
import {
  assertCurriculumOwned,
  getActorId,
} from "@/lib/curriculum/server-helpers";
import type {
  CurriculumActionResult,
  ResourceInput,
} from "@/lib/curriculum/types";
import { validateResourceInput } from "@/lib/curriculum/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function upsertResourceAction(
  input: ResourceInput & { id?: string },
): Promise<CurriculumActionResult> {
  const fieldErrors = validateResourceInput(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext(
    "curriculum.resource.edit",
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
    title: input.title.trim(),
    resource_kind: input.resourceKind ?? "link",
    url: input.url?.trim() || null,
    media_id: input.mediaId ?? null,
    visibility: input.visibility ?? "shared",
    display_order: input.displayOrder ?? 0,
    unit_id: input.unitId ?? null,
    chapter_id: input.chapterId ?? null,
    topic_id: input.topicId ?? null,
    subtopic_id: input.subtopicId ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("curriculum_resources")
      .update(row)
      .eq("id", input.id)
      .eq("school_id", schoolId);
    if (error) return { success: false, error: error.message };
    await writeCurriculumAudit(supabase, {
      schoolId,
      action: "resource.update",
      entityType: "resource",
      entityId: input.id,
      actorAuthUserId: actorId,
      newValues: row,
    });
    return { success: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("curriculum_resources")
    .insert({ ...row, created_by: actorId })
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data?.id) return { success: false, error: "Insert failed" };

  await writeCurriculumAudit(supabase, {
    schoolId,
    action: "resource.create",
    entityType: "resource",
    entityId: data.id,
    actorAuthUserId: actorId,
    newValues: row,
  });
  return { success: true, id: data.id };
}

export async function archiveResourceAction(
  resourceId: string,
): Promise<CurriculumActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "curriculum.resource.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("curriculum_resources")
    .update({ archived_at: now, updated_at: now })
    .eq("id", resourceId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };

  await writeCurriculumAudit(supabase, {
    schoolId,
    action: "resource.archive",
    entityType: "resource",
    entityId: resourceId,
    actorAuthUserId: actorId,
  });
  return { success: true, id: resourceId };
}
