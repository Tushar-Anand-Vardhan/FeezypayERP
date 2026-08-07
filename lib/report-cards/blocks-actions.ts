"use server";

import { revalidatePath } from "next/cache";
import {
  assertTemplateOwned,
  getActorId,
} from "@/lib/report-cards/server-helpers";
import type {
  BlockInput,
  ReportCardActionResult,
} from "@/lib/report-cards/types";
import {
  isTemplateMutable,
  validateBlockInput,
} from "@/lib/report-cards/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/report-cards");
}

export async function listReportCardBlocksAction(
  templateId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      blocks: Array<{
        id: string;
        template_id: string;
        block_type: string;
        title: string | null;
        config: unknown;
        display_order: number;
        is_visible: boolean;
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
  const owned = await assertTemplateOwned(supabase, schoolId, templateId, {
    allowArchived: true,
  });
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }

  let query = supabase
    .from("report_card_template_blocks")
    .select(
      "id, template_id, block_type, title, config, display_order, is_visible, archived_at",
    )
    .eq("template_id", templateId)
    .order("display_order", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, blocks: data ?? [] };
}

export async function upsertReportCardBlockAction(
  input: BlockInput,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateBlockInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const owned = await assertTemplateOwned(supabase, schoolId, input.templateId);
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }
  if (!isTemplateMutable(owned.status)) {
    return { success: false, error: "Only draft templates can be edited." };
  }

  const actorId = await getActorId(supabase);
  const payload = {
    template_id: input.templateId,
    block_type: input.blockType,
    title: input.title?.trim() || null,
    config: input.config ?? {},
    display_order: input.displayOrder ?? 0,
    is_visible: input.isVisible ?? true,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("report_card_template_blocks")
      .update(payload)
      .eq("id", input.id)
      .eq("template_id", input.templateId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: error?.message ?? "Block not found." };
    }

    revalidate();
    return { success: true, message: "Section updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("report_card_template_blocks")
    .insert({ ...payload, created_by: actorId })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create section.",
    };
  }

  revalidate();
  return { success: true, message: "Section added.", id: data.id };
}

export async function reorderReportCardBlocksAction(
  templateId: string,
  orderedBlockIds: string[],
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  if (!orderedBlockIds.length) {
    return { success: false, error: "Provide at least one block id." };
  }

  const { supabase, schoolId } = context;
  const owned = await assertTemplateOwned(supabase, schoolId, templateId);
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }
  if (!isTemplateMutable(owned.status)) {
    return { success: false, error: "Only draft templates can be edited." };
  }

  const now = new Date().toISOString();
  for (let i = 0; i < orderedBlockIds.length; i += 1) {
    const { error } = await supabase
      .from("report_card_template_blocks")
      .update({ display_order: i + 1, updated_at: now })
      .eq("id", orderedBlockIds[i])
      .eq("template_id", templateId)
      .is("archived_at", null);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  revalidate();
  return { success: true, message: "Sections reordered.", id: templateId };
}

export async function archiveReportCardBlockAction(
  blockId: string,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: row } = await supabase
    .from("report_card_template_blocks")
    .select("id, template_id")
    .eq("id", blockId)
    .is("archived_at", null)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Section not found." };
  }

  const owned = await assertTemplateOwned(supabase, schoolId, row.template_id);
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }
  if (!isTemplateMutable(owned.status)) {
    return { success: false, error: "Only draft templates can be edited." };
  }

  const { error } = await supabase
    .from("report_card_template_blocks")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", blockId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Section archived.", id: blockId };
}
