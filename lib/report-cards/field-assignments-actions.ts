"use server";

import { revalidatePath } from "next/cache";
import {
  assertTemplateOwned,
  getActorId,
} from "@/lib/report-cards/server-helpers";
import type { ReportCardActionResult } from "@/lib/report-cards/types";
import type { FieldAssignmentInput } from "@/lib/report-cards/types";
import { validateFieldAssignmentInput } from "@/lib/report-cards/ops-validation";
import { isTemplateMutable } from "@/lib/report-cards/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/report-cards");
}

export async function upsertReportCardFieldAssignmentAction(
  input: FieldAssignmentInput,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext("document.template.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateFieldAssignmentInput(input);
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
    return {
      success: false,
      error: "Published templates are immutable — clone to a draft to edit.",
    };
  }

  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const payload = {
    school_id: schoolId,
    template_id: input.templateId,
    field_key: input.fieldKey.trim(),
    field_label: input.fieldLabel.trim(),
    assignee_role: input.assigneeRole ?? "teacher",
    subject_id: input.subjectId ?? null,
    required: input.required ?? false,
    max_length: input.maxLength ?? 5000,
    display_order: input.displayOrder ?? 0,
    updated_at: now,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("report_card_template_field_assignments")
      .update(payload)
      .eq("id", input.id)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Could not update field assignment.",
      };
    }
    revalidate();
    return { success: true, message: "Field assignment updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("report_card_template_field_assignments")
    .insert({ ...payload, created_by: actorId })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create field assignment.",
    };
  }

  revalidate();
  return { success: true, message: "Field assignment created.", id: data.id };
}

export async function archiveReportCardFieldAssignmentAction(
  assignmentId: string,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext("document.template.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: row } = await supabase
    .from("report_card_template_field_assignments")
    .select("id, template_id")
    .eq("id", assignmentId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Field assignment not found." };
  }

  const owned = await assertTemplateOwned(
    supabase,
    schoolId,
    row.template_id as string,
  );
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }
  if (!isTemplateMutable(owned.status)) {
    return {
      success: false,
      error: "Published templates are immutable — clone to a draft to edit.",
    };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("report_card_template_field_assignments")
    .update({ archived_at: now, updated_at: now })
    .eq("id", assignmentId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Field assignment archived.", id: assignmentId };
}

export async function listReportCardFieldAssignmentsAction(
  templateId: string,
): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("document.report_card.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertTemplateOwned(supabase, schoolId, templateId);
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }

  const { data, error } = await supabase
    .from("report_card_template_field_assignments")
    .select(
      "id, template_id, field_key, field_label, assignee_role, subject_id, required, max_length, display_order",
    )
    .eq("template_id", templateId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .order("display_order", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, rows: data ?? [] };
}
