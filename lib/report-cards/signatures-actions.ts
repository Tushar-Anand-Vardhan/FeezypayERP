"use server";

import { revalidatePath } from "next/cache";
import {
  assertTemplateOwned,
  getActorId,
} from "@/lib/report-cards/server-helpers";
import type {
  ReportCardActionResult,
  SignatureSlotInput,
} from "@/lib/report-cards/types";
import {
  isTemplateMutable,
  validateSignatureSlotInput,
} from "@/lib/report-cards/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/report-cards");
}

export async function listReportCardSignaturesAction(
  templateId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      signatures: Array<{
        id: string;
        template_id: string;
        role_label: string;
        signature_type: string;
        display_order: number;
        requires_digital: boolean;
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
    .from("report_card_template_signatures")
    .select(
      "id, template_id, role_label, signature_type, display_order, requires_digital, archived_at",
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

  return { success: true, signatures: data ?? [] };
}

export async function upsertReportCardSignatureAction(
  input: SignatureSlotInput,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateSignatureSlotInput(input);
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
    role_label: input.roleLabel.trim(),
    signature_type: input.signatureType ?? "wet_ink",
    display_order: input.displayOrder ?? 0,
    requires_digital: input.requiresDigital ?? false,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("report_card_template_signatures")
      .update(payload)
      .eq("id", input.id)
      .eq("template_id", input.templateId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Signature slot not found.",
      };
    }

    revalidate();
    return { success: true, message: "Signature slot updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("report_card_template_signatures")
    .insert({ ...payload, created_by: actorId })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create signature slot.",
    };
  }

  revalidate();
  return { success: true, message: "Signature slot added.", id: data.id };
}

export async function archiveReportCardSignatureAction(
  signatureId: string,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: row } = await supabase
    .from("report_card_template_signatures")
    .select("id, template_id")
    .eq("id", signatureId)
    .is("archived_at", null)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Signature slot not found." };
  }

  const owned = await assertTemplateOwned(supabase, schoolId, row.template_id);
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }
  if (!isTemplateMutable(owned.status)) {
    return { success: false, error: "Only draft templates can be edited." };
  }

  const { error } = await supabase
    .from("report_card_template_signatures")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", signatureId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Signature slot archived.", id: signatureId };
}
