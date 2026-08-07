"use server";

import { revalidatePath } from "next/cache";
import {
  assertAudienceGroupOwned,
  assertCategoryOwned,
  assertDeliveryRuleOwned,
  assertPriorityOwned,
  assertTemplateOwned,
  getActorId,
} from "@/lib/communications/server-helpers";
import type {
  ApprovalRuleInput,
  AutomationInput,
  CampaignInput,
  CommActionResult,
  DeliveryRuleInput,
} from "@/lib/communications/types";
import {
  ensureCommCode,
  validateApprovalRuleInput,
  validateAutomationInput,
  validateCampaignInput,
  validateDeliveryRuleInput,
} from "@/lib/communications/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/communications");
}

export async function listDeliveryRulesAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | { success: true; rules: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("communication.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("comm_delivery_rules")
    .select(
      "id, code, name, description, event_code, channels, priority_id, audience_group_id, template_id, category_id, respect_quiet_hours, require_consent, is_enabled, rules, archived_at",
    )
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rules: data ?? [] };
}

export async function upsertDeliveryRuleAction(
  input: DeliveryRuleInput,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext("communication.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateDeliveryRuleInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;

  if (input.priorityId) {
    if (!(await assertPriorityOwned(supabase, schoolId, input.priorityId))) {
      return { success: false, error: "Priority not found." };
    }
  }
  if (input.audienceGroupId) {
    if (
      !(await assertAudienceGroupOwned(
        supabase,
        schoolId,
        input.audienceGroupId,
      ))
    ) {
      return { success: false, error: "Audience group not found." };
    }
  }
  if (input.templateId) {
    const tpl = await assertTemplateOwned(supabase, schoolId, input.templateId);
    if (!tpl.ok) {
      return { success: false, error: "Template not found." };
    }
  }
  if (input.categoryId) {
    if (!(await assertCategoryOwned(supabase, schoolId, input.categoryId))) {
      return { success: false, error: "Category not found." };
    }
  }

  const actorId = await getActorId(supabase);
  const payload = {
    school_id: schoolId,
    code: ensureCommCode(input.name, input.code, "DEL"),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    event_code: input.eventCode?.trim() || null,
    channels: input.channels ?? [],
    priority_id: input.priorityId || null,
    audience_group_id: input.audienceGroupId || null,
    template_id: input.templateId || null,
    category_id: input.categoryId || null,
    respect_quiet_hours: input.respectQuietHours ?? true,
    require_consent: input.requireConsent ?? true,
    is_enabled: input.isEnabled ?? true,
    rules: input.rules ?? {},
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("comm_delivery_rules")
      .update(payload)
      .eq("id", input.id)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Delivery rule not found.",
      };
    }
    revalidate();
    return { success: true, message: "Delivery rule updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("comm_delivery_rules")
    .insert({ ...payload, created_by: actorId })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create delivery rule.",
    };
  }
  revalidate();
  return { success: true, message: "Delivery rule created.", id: data.id };
}

export async function archiveDeliveryRuleAction(
  ruleId: string,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext("communication.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data, error } = await supabase
    .from("comm_delivery_rules")
    .update({
      archived_at: new Date().toISOString(),
      is_enabled: false,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Delivery rule not found.",
    };
  }
  revalidate();
  return { success: true, message: "Delivery rule archived.", id: data.id };
}

export async function listApprovalRulesAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | { success: true; rules: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("communication.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("comm_approval_rules")
    .select(
      "id, code, name, description, require_approval, min_priority_id, category_id, audience_group_id, approver_roles, is_enabled, rules, archived_at",
    )
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rules: data ?? [] };
}

export async function upsertApprovalRuleAction(
  input: ApprovalRuleInput,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext("communication.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateApprovalRuleInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;

  if (input.minPriorityId) {
    if (!(await assertPriorityOwned(supabase, schoolId, input.minPriorityId))) {
      return { success: false, error: "Priority not found." };
    }
  }
  if (input.categoryId) {
    if (!(await assertCategoryOwned(supabase, schoolId, input.categoryId))) {
      return { success: false, error: "Category not found." };
    }
  }
  if (input.audienceGroupId) {
    if (
      !(await assertAudienceGroupOwned(
        supabase,
        schoolId,
        input.audienceGroupId,
      ))
    ) {
      return { success: false, error: "Audience group not found." };
    }
  }

  const actorId = await getActorId(supabase);
  const payload = {
    school_id: schoolId,
    code: ensureCommCode(input.name, input.code, "APR"),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    require_approval: input.requireApproval ?? true,
    min_priority_id: input.minPriorityId || null,
    category_id: input.categoryId || null,
    audience_group_id: input.audienceGroupId || null,
    approver_roles: input.approverRoles ?? ["school_admin"],
    is_enabled: input.isEnabled ?? true,
    rules: input.rules ?? {},
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("comm_approval_rules")
      .update(payload)
      .eq("id", input.id)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Approval rule not found.",
      };
    }
    revalidate();
    return { success: true, message: "Approval rule updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("comm_approval_rules")
    .insert({ ...payload, created_by: actorId })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create approval rule.",
    };
  }
  revalidate();
  return { success: true, message: "Approval rule created.", id: data.id };
}

export async function archiveApprovalRuleAction(
  ruleId: string,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext("communication.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data, error } = await supabase
    .from("comm_approval_rules")
    .update({
      archived_at: new Date().toISOString(),
      is_enabled: false,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Approval rule not found.",
    };
  }
  revalidate();
  return { success: true, message: "Approval rule archived.", id: data.id };
}

/** FUTURE shell — config only; never triggers sends. */
export async function upsertAutomationAction(
  input: AutomationInput,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext("communication.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateAutomationInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (input.deliveryRuleId) {
    if (
      !(await assertDeliveryRuleOwned(supabase, schoolId, input.deliveryRuleId))
    ) {
      return { success: false, error: "Delivery rule not found." };
    }
  }

  const payload = {
    school_id: schoolId,
    code: ensureCommCode(input.name, input.code, "AUTO"),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    trigger_event: input.triggerEvent?.trim() || null,
    delivery_rule_id: input.deliveryRuleId || null,
    is_enabled: false, // FUTURE: never auto-enable execution
    config: {
      ...(input.config ?? {}),
      future: true,
      note: "Automation execution not wired.",
    },
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("comm_automations")
      .update(payload)
      .eq("id", input.id)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Automation not found.",
      };
    }
    revalidate();
    return {
      success: true,
      message: "Automation config saved (not executed).",
      id: data.id,
    };
  }

  const { data, error } = await supabase
    .from("comm_automations")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create automation.",
    };
  }
  revalidate();
  return {
    success: true,
    message: "Automation config created (not executed).",
    id: data.id,
  };
}

/** FUTURE shell — config only; never sends. */
export async function upsertCampaignAction(
  input: CampaignInput,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext("communication.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateCampaignInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (input.audienceGroupId) {
    if (
      !(await assertAudienceGroupOwned(
        supabase,
        schoolId,
        input.audienceGroupId,
      ))
    ) {
      return { success: false, error: "Audience group not found." };
    }
  }
  if (input.templateId) {
    const tpl = await assertTemplateOwned(supabase, schoolId, input.templateId);
    if (!tpl.ok) {
      return { success: false, error: "Template not found." };
    }
  }

  const payload = {
    school_id: schoolId,
    code: ensureCommCode(input.name, input.code, "CMP"),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    status: "draft" as const,
    audience_group_id: input.audienceGroupId || null,
    template_id: input.templateId || null,
    scheduled_at: input.scheduledAt || null,
    config: {
      ...(input.config ?? {}),
      future: true,
      note: "Campaign sending not wired.",
    },
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("comm_campaigns")
      .update(payload)
      .eq("id", input.id)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return { success: false, error: error?.message ?? "Campaign not found." };
    }
    revalidate();
    return {
      success: true,
      message: "Campaign config saved (not sent).",
      id: data.id,
    };
  }

  const { data, error } = await supabase
    .from("comm_campaigns")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create campaign.",
    };
  }
  revalidate();
  return {
    success: true,
    message: "Campaign config created (not sent).",
    id: data.id,
  };
}
