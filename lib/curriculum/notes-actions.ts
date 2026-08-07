"use server";

import { writeCurriculumAudit } from "@/lib/curriculum/audit";
import {
  assertCurriculumOwned,
  getActorId,
} from "@/lib/curriculum/server-helpers";
import type { CurriculumActionResult, NoteInput } from "@/lib/curriculum/types";
import { validateNoteInput } from "@/lib/curriculum/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function upsertNoteAction(
  input: NoteInput & { id?: string },
): Promise<CurriculumActionResult> {
  const fieldErrors = validateNoteInput(input);
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

  const actorId = await getActorId(supabase);
  const row = {
    school_id: schoolId,
    curriculum_id: input.curriculumId,
    body: input.body.trim(),
    author_employment_id: input.authorEmploymentId,
    visibility: input.visibility ?? "private",
    unit_id: input.unitId ?? null,
    chapter_id: input.chapterId ?? null,
    topic_id: input.topicId ?? null,
    subtopic_id: input.subtopicId ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data: existing } = await supabase
      .from("curriculum_notes")
      .select("id, author_employment_id, visibility")
      .eq("id", input.id)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .maybeSingle();
    if (!existing) return { success: false, error: "Note not found" };
    if (existing.author_employment_id !== input.authorEmploymentId) {
      return { success: false, error: "Only the author can edit this note" };
    }

    const { error } = await supabase
      .from("curriculum_notes")
      .update(row)
      .eq("id", input.id)
      .eq("school_id", schoolId);
    if (error) return { success: false, error: error.message };
    return { success: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("curriculum_notes")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data?.id) return { success: false, error: "Insert failed" };

  await writeCurriculumAudit(supabase, {
    schoolId,
    action: "note.create",
    entityType: "note",
    entityId: data.id,
    actorAuthUserId: actorId,
    metadata: { visibility: row.visibility },
  });
  return { success: true, id: data.id };
}

export async function listNotesAction(options: {
  curriculumId: string;
  authorEmploymentId: string;
  includeShared?: boolean;
}): Promise<
  | { success: true; notes: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "curriculum.progress.record",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;

  let query = supabase
    .from("curriculum_notes")
    .select("*")
    .eq("school_id", schoolId)
    .eq("curriculum_id", options.curriculumId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (options.includeShared) {
    query = query.or(
      `author_employment_id.eq.${options.authorEmploymentId},visibility.eq.shared`,
    );
  } else {
    query = query.eq("author_employment_id", options.authorEmploymentId);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, notes: data ?? [] };
}

export async function archiveNoteAction(
  noteId: string,
  authorEmploymentId: string,
): Promise<CurriculumActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "curriculum.progress.record",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const { data: existing } = await supabase
    .from("curriculum_notes")
    .select("id, author_employment_id")
    .eq("id", noteId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!existing) return { success: false, error: "Note not found" };
  if (existing.author_employment_id !== authorEmploymentId) {
    return { success: false, error: "Only the author can archive this note" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("curriculum_notes")
    .update({ archived_at: now, updated_at: now })
    .eq("id", noteId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };
  return { success: true, id: noteId };
}
