"use server";

import { revalidatePath } from "next/cache";
import { ensureSubjectCode } from "@/lib/config/codes";
import {
  trimSubjectInputs,
  validateSubjectInputs,
} from "@/lib/config/subjects";
import type { ConfigActionResult, SubjectInput } from "@/lib/config/types";
import { evaluateConfigEdit } from "@/lib/editing/evaluate";
import { recordConfigMutation } from "@/lib/editing/record";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

type SubjectRow = {
  id: string;
  name: string;
  code: string | null;
  type: string;
  archived_at: string | null;
};

async function getActorId(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function listSubjectsAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | { success: true; subjects: SubjectRow[] }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("subjects")
    .select("id, name, code, type, archived_at")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, subjects: data ?? [] };
}

/**
 * Upsert subjects by id or name; archive active subjects omitted from the list.
 * Never hard-deletes (preserves employment/exam/timetable FKs).
 */
export async function syncSubjectsCatalogAction(
  inputs: SubjectInput[],
  options: { requireAtLeastOne?: boolean; archiveMissing?: boolean } = {},
): Promise<ConfigActionResult & { subjectIdByName?: Record<string, string> }> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const archiveMissing = options.archiveMissing ?? true;
  const trimmed = trimSubjectInputs(inputs);
  const fieldErrors = validateSubjectInputs(trimmed, {
    requireAtLeastOne: options.requireAtLeastOne,
  });

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from("subjects")
    .select("id, name, code, type, archived_at")
    .eq("school_id", schoolId);

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  const byId = new Map((existing ?? []).map((row) => [row.id, row]));
  const activeByName = new Map(
    (existing ?? [])
      .filter((row) => row.archived_at == null)
      .map((row) => [row.name.toLowerCase(), row]),
  );

  const keptIds = new Set<string>();
  const subjectIdByName: Record<string, string> = {};

  for (const row of trimmed) {
    const code = ensureSubjectCode(row.name, row.code);
    const matched =
      (row.id ? byId.get(row.id) : undefined) ??
      activeByName.get(row.name.toLowerCase());

    if (matched) {
      const nextCode =
        matched.code && matched.code.trim()
          ? matched.code
          : code;

      const { error: updateError } = await supabase
        .from("subjects")
        .update({
          name: row.name,
          code: nextCode,
          type: row.type,
          archived_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", matched.id)
        .eq("school_id", schoolId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      keptIds.add(matched.id);
      subjectIdByName[row.name.toLowerCase()] = matched.id;
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("subjects")
      .insert({
        school_id: schoolId,
        name: row.name,
        code,
        type: row.type,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !inserted) {
      return {
        success: false,
        error: insertError?.message ?? "Could not create subject.",
      };
    }

    keptIds.add(inserted.id);
    subjectIdByName[row.name.toLowerCase()] = inserted.id;
  }

  if (archiveMissing) {
    const toArchive = (existing ?? []).filter(
      (row) => row.archived_at == null && !keptIds.has(row.id),
    );

    for (const row of toArchive) {
      const { error: archiveError } = await supabase
        .from("subjects")
        .update({
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("school_id", schoolId);

      if (archiveError) {
        return { success: false, error: archiveError.message };
      }
    }
  }

  revalidatePath("/onboarding", "layout");

  return {
    success: true,
    message: "Subjects saved.",
    subjectIdByName,
  };
}

export async function archiveSubjectAction(
  subjectId: string,
): Promise<ConfigActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: before } = await supabase
    .from("subjects")
    .select("id, name, code, type, archived_at")
    .eq("id", subjectId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!before) {
    return { success: false, error: "Subject not found." };
  }

  const evaluation = await evaluateConfigEdit({
    supabase,
    entityType: "subject",
    entityId: subjectId,
    action: "archive",
    before,
  });
  if (!evaluation.allowed) {
    return {
      success: false,
      error: [
        ...evaluation.reasons,
        ...evaluation.softMigrations.map((m) => `${m.title}: ${m.rationale}`),
      ].join(" "),
    };
  }

  const { error } = await supabase
    .from("subjects")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subjectId)
    .eq("school_id", schoolId)
    .is("archived_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  const actorId = await getActorId(supabase);
  await recordConfigMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityType: "subject",
    entityId: subjectId,
    action: "archive",
    before,
    after: { ...before, archived_at: new Date().toISOString() },
    softMigration: evaluation.softMigrations,
  });

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "Subject archived.", id: subjectId };
}

export async function restoreSubjectAction(
  subjectId: string,
): Promise<ConfigActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: before } = await supabase
    .from("subjects")
    .select("id, name, code, type, archived_at")
    .eq("id", subjectId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!before) {
    return { success: false, error: "Subject not found." };
  }

  const { error } = await supabase
    .from("subjects")
    .update({
      archived_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subjectId)
    .eq("school_id", schoolId);

  if (error) {
    return {
      success: false,
      error:
        error.message.includes("unique") || error.code === "23505"
          ? "Cannot restore: an active subject already uses this name or code."
          : error.message,
    };
  }

  const actorId = await getActorId(supabase);
  await recordConfigMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityType: "subject",
    entityId: subjectId,
    action: "restore",
    before,
    after: { ...before, archived_at: null },
  });

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "Subject restored.", id: subjectId };
}

/** Single-subject update with semantic dependency gates. */
export async function updateSubjectAction(input: {
  id: string;
  name: string;
  code?: string;
  type?: string;
}): Promise<ConfigActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: before } = await supabase
    .from("subjects")
    .select("id, name, code, type, archived_at")
    .eq("id", input.id)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!before) {
    return { success: false, error: "Subject not found." };
  }

  const after = {
    ...before,
    name: input.name.trim(),
    code: ensureSubjectCode(input.name, input.code ?? before.code),
    type: input.type ?? before.type,
  };

  const evaluation = await evaluateConfigEdit({
    supabase,
    entityType: "subject",
    entityId: input.id,
    action: "update",
    before,
    after,
  });

  if (!evaluation.allowed) {
    return {
      success: false,
      error: [
        ...evaluation.reasons,
        ...evaluation.softMigrations.map(
          (m) => `${m.title}: ${m.rationale}`,
        ),
      ].join(" "),
    };
  }

  const { error } = await supabase
    .from("subjects")
    .update({
      name: after.name,
      code: after.code,
      type: after.type,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  const actorId = await getActorId(supabase);
  await recordConfigMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityType: "subject",
    entityId: input.id,
    action: "update",
    before,
    after,
    softMigration: evaluation.softMigrations,
    metadata: { strategy: evaluation.strategy },
  });

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "Subject updated.", id: input.id };
}

export async function duplicateSubjectAction(
  subjectId: string,
): Promise<ConfigActionResult> {
  const { duplicateConfigRowAction } = await import("@/lib/editing/actions");
  const result = await duplicateConfigRowAction({
    entityType: "subject",
    sourceId: subjectId,
  });
  if (!result.success) {
    return { success: false, error: result.error };
  }
  revalidatePath("/onboarding", "layout");
  return { success: true, message: result.message, id: result.id };
}
