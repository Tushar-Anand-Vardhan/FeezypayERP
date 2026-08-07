"use server";

import { revalidatePath } from "next/cache";
import {
  assertExamDefinitionInSchool,
  assertTemplateOwned,
  getActorId,
} from "@/lib/report-cards/server-helpers";
import type {
  AssessmentBindingInput,
  ReportCardActionResult,
} from "@/lib/report-cards/types";
import {
  isTemplateMutable,
  validateAssessmentBindingInput,
} from "@/lib/report-cards/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/report-cards");
}

export async function listReportCardAssessmentBindingsAction(
  templateId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      bindings: Array<{
        id: string;
        template_id: string;
        exam_definition_id: string;
        display_label: string | null;
        display_order: number;
        include_components: boolean;
        show_max_marks: boolean;
        show_pass_marks: boolean;
        show_grades: boolean;
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
    .from("report_card_template_assessments")
    .select(
      "id, template_id, exam_definition_id, display_label, display_order, include_components, show_max_marks, show_pass_marks, show_grades, archived_at",
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

  return { success: true, bindings: data ?? [] };
}

export async function upsertReportCardAssessmentBindingAction(
  input: AssessmentBindingInput,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateAssessmentBindingInput(input);
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

  if (
    !(await assertExamDefinitionInSchool(
      supabase,
      schoolId,
      input.examDefinitionId,
    ))
  ) {
    return { success: false, error: "Assessment not found." };
  }

  const actorId = await getActorId(supabase);
  const payload = {
    template_id: input.templateId,
    exam_definition_id: input.examDefinitionId,
    display_label: input.displayLabel?.trim() || null,
    display_order: input.displayOrder ?? 0,
    include_components: input.includeComponents ?? true,
    show_max_marks: input.showMaxMarks ?? true,
    show_pass_marks: input.showPassMarks ?? true,
    show_grades: input.showGrades ?? true,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("report_card_template_assessments")
      .update(payload)
      .eq("id", input.id)
      .eq("template_id", input.templateId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Assessment binding not found.",
      };
    }

    revalidate();
    return { success: true, message: "Assessment binding updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("report_card_template_assessments")
    .insert({ ...payload, created_by: actorId })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not bind assessment.",
    };
  }

  revalidate();
  return { success: true, message: "Assessment bound.", id: data.id };
}

export async function archiveReportCardAssessmentBindingAction(
  bindingId: string,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: row } = await supabase
    .from("report_card_template_assessments")
    .select("id, template_id")
    .eq("id", bindingId)
    .is("archived_at", null)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Assessment binding not found." };
  }

  const owned = await assertTemplateOwned(supabase, schoolId, row.template_id);
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }
  if (!isTemplateMutable(owned.status)) {
    return { success: false, error: "Only draft templates can be edited." };
  }

  const { error } = await supabase
    .from("report_card_template_assessments")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", bindingId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Assessment binding archived.", id: bindingId };
}
