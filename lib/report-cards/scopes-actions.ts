"use server";

import { revalidatePath } from "next/cache";
import {
  assertClassInSchool,
  assertSectionInSchool,
  assertTemplateOwned,
  getActorId,
} from "@/lib/report-cards/server-helpers";
import type {
  ReportCardActionResult,
  ScopeInput,
} from "@/lib/report-cards/types";
import {
  isTemplateMutable,
  validateScopeInput,
} from "@/lib/report-cards/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/report-cards");
}

export async function listReportCardScopesAction(
  templateId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      scopes: Array<{
        id: string;
        template_id: string;
        class_id: string | null;
        section_id: string | null;
        display_order: number;
        archived_at: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("document.template.edit");
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
    .from("report_card_template_scopes")
    .select(
      "id, template_id, class_id, section_id, display_order, archived_at",
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

  return { success: true, scopes: data ?? [] };
}

export async function upsertReportCardScopeAction(
  input: ScopeInput,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext("document.template.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateScopeInput(input);
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

  let classId = input.classId || null;
  const sectionId = input.sectionId || null;

  if (classId) {
    if (!(await assertClassInSchool(supabase, schoolId, classId))) {
      return { success: false, error: "Class not found." };
    }
  }

  if (sectionId) {
    const section = await assertSectionInSchool(supabase, schoolId, sectionId);
    if (!section.ok) {
      return { success: false, error: "Section not found." };
    }
    if (classId && section.classId && classId !== section.classId) {
      return {
        success: false,
        error: "Section does not belong to the selected class.",
      };
    }
    if (!classId) {
      classId = section.classId ?? null;
    }
  }

  const actorId = await getActorId(supabase);
  const payload = {
    template_id: input.templateId,
    class_id: classId,
    section_id: sectionId,
    display_order: input.displayOrder ?? 0,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("report_card_template_scopes")
      .update(payload)
      .eq("id", input.id)
      .eq("template_id", input.templateId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: error?.message ?? "Scope not found." };
    }

    revalidate();
    return { success: true, message: "Scope updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("report_card_template_scopes")
    .insert({ ...payload, created_by: actorId })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create scope.",
    };
  }

  revalidate();
  return { success: true, message: "Scope added.", id: data.id };
}

export async function archiveReportCardScopeAction(
  scopeId: string,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext("document.template.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: row } = await supabase
    .from("report_card_template_scopes")
    .select("id, template_id")
    .eq("id", scopeId)
    .is("archived_at", null)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Scope not found." };
  }

  const owned = await assertTemplateOwned(supabase, schoolId, row.template_id);
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }
  if (!isTemplateMutable(owned.status)) {
    return { success: false, error: "Only draft templates can be edited." };
  }

  const { error } = await supabase
    .from("report_card_template_scopes")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", scopeId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Scope archived.", id: scopeId };
}
