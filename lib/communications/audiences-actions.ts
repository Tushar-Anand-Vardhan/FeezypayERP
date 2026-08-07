"use server";

import { revalidatePath } from "next/cache";
import {
  assertAudienceGroupOwned,
  getActorId,
} from "@/lib/communications/server-helpers";
import type {
  AudienceGroupInput,
  CommActionResult,
} from "@/lib/communications/types";
import {
  ensureCommCode,
  filterRulesToJson,
  validateAudienceGroupInput,
} from "@/lib/communications/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/communications");
}

export async function listAudienceGroupsAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | {
      success: true;
      groups: Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        filter_rules: unknown;
        display_order: number;
        archived_at: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("comm_audience_groups")
    .select(
      "id, code, name, description, filter_rules, display_order, archived_at",
    )
    .eq("school_id", schoolId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, groups: data ?? [] };
}

export async function upsertAudienceGroupAction(
  input: AudienceGroupInput,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateAudienceGroupInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const payload = {
    school_id: schoolId,
    code: ensureCommCode(input.name, input.code, "AUD"),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    filter_rules: filterRulesToJson(input.filterRules),
    display_order: input.displayOrder ?? 0,
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    if (!(await assertAudienceGroupOwned(supabase, schoolId, input.id))) {
      // allow update path with id check via update filter
    }
    const { data, error } = await supabase
      .from("comm_audience_groups")
      .update(payload)
      .eq("id", input.id)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Audience group not found.",
      };
    }
    revalidate();
    return { success: true, message: "Audience group updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("comm_audience_groups")
    .insert({ ...payload, created_by: actorId })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create audience group.",
    };
  }
  revalidate();
  return { success: true, message: "Audience group created.", id: data.id };
}

export async function archiveAudienceGroupAction(
  groupId: string,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data, error } = await supabase
    .from("comm_audience_groups")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", groupId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Audience group not found.",
    };
  }
  revalidate();
  return { success: true, message: "Audience group archived.", id: data.id };
}
