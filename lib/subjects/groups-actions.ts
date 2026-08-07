"use server";

import { revalidatePath } from "next/cache";
import { ensureSubjectGroupCode } from "@/lib/subjects/codes";
import {
  assertSubjectGroupOwned,
  getActorId,
} from "@/lib/subjects/server-helpers";
import type { SubjectActionResult, SubjectGroupInput } from "@/lib/subjects/types";
import {
  trimSubjectGroupInput,
  validateSubjectGroupInput,
} from "@/lib/subjects/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/subjects");
  revalidatePath("/onboarding", "layout");
}

export async function listSubjectGroupsAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | {
      success: true;
      groups: Array<{
        id: string;
        name: string;
        code: string | null;
        description: string | null;
        display_order: number;
        archived_at: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("subject_groups")
    .select("id, name, code, description, display_order, archived_at")
    .eq("school_id", schoolId)
    .order("display_order", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, groups: data ?? [] };
}

export async function createSubjectGroupAction(
  input: SubjectGroupInput,
): Promise<SubjectActionResult> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimSubjectGroupInput(input);
  const fieldErrors = validateSubjectGroupInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const { data, error } = await supabase
    .from("subject_groups")
    .insert({
      school_id: schoolId,
      name: trimmed.name,
      code: ensureSubjectGroupCode(trimmed.name, trimmed.code),
      description: trimmed.description || null,
      display_order: trimmed.displayOrder ?? 0,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create subject group.",
    };
  }

  revalidate();
  return { success: true, message: "Subject group created.", id: data.id };
}

export async function updateSubjectGroupAction(
  input: SubjectGroupInput & { id: string },
): Promise<SubjectActionResult> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimSubjectGroupInput(input);
  const fieldErrors = validateSubjectGroupInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (!(await assertSubjectGroupOwned(supabase, schoolId, input.id))) {
    return { success: false, error: "Subject group not found." };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("subject_groups")
    .update({
      name: trimmed.name,
      code: ensureSubjectGroupCode(trimmed.name, trimmed.code),
      description: trimmed.description || null,
      display_order: trimmed.displayOrder ?? 0,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Subject group updated.", id: input.id };
}

export async function archiveSubjectGroupAction(
  groupId: string,
): Promise<SubjectActionResult> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("subject_groups")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", groupId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Subject group archived.", id: groupId };
}

export async function restoreSubjectGroupAction(
  groupId: string,
): Promise<SubjectActionResult> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("subject_groups")
    .update({
      archived_at: null,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", groupId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Subject group restored.", id: groupId };
}
