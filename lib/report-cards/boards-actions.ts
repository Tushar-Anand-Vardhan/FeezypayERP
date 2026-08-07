"use server";

import { revalidatePath } from "next/cache";
import { getActorId } from "@/lib/report-cards/server-helpers";
import type { BoardInput, ReportCardActionResult } from "@/lib/report-cards/types";
import {
  ensureBoardCode,
  validateBoardInput,
} from "@/lib/report-cards/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/report-cards");
}

export async function listReportCardBoardsAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | {
      success: true;
      boards: Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
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
    .from("report_card_boards")
    .select("id, code, name, description, display_order, archived_at")
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

  return { success: true, boards: data ?? [] };
}

export async function upsertReportCardBoardAction(
  input: BoardInput,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateBoardInput(input);
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
    code: ensureBoardCode(input.name, input.code),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    display_order: input.displayOrder ?? 0,
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("report_card_boards")
      .update(payload)
      .eq("id", input.id)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: error?.message ?? "Board not found." };
    }

    revalidate();
    return { success: true, message: "Board updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("report_card_boards")
    .insert({ ...payload, created_by: actorId })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create board.",
    };
  }

  revalidate();
  return { success: true, message: "Board created.", id: data.id };
}

export async function archiveReportCardBoardAction(
  boardId: string,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data, error } = await supabase
    .from("report_card_boards")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", boardId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Board not found." };
  }

  revalidate();
  return { success: true, message: "Board archived.", id: data.id };
}
