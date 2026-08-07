"use server";

import { revalidatePath } from "next/cache";
import {
  assertCategoryOwned,
  assertTemplateOwned,
  getActorId,
  getLatestTemplateVersion,
} from "@/lib/communications/server-helpers";
import type {
  CommActionResult,
  CommChannel,
  TemplateInput,
  TemplateVersionInput,
} from "@/lib/communications/types";
import {
  ensureCommCode,
  extractPlaceholders,
  validateTemplateInput,
  validateTemplateVersionInput,
} from "@/lib/communications/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/communications");
}

export async function listMessageTemplatesAction(options?: {
  includeArchived?: boolean;
  channel?: CommChannel;
}): Promise<
  | { success: true; templates: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("comm_message_templates")
    .select(
      "id, code, name, description, channel, category_id, locale, status, provider_template_name, provider_template_locale, archived_at",
    )
    .eq("school_id", schoolId)
    .order("channel", { ascending: true })
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (options?.channel) {
    query = query.eq("channel", options.channel);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, templates: data ?? [] };
}

export async function upsertMessageTemplateAction(
  input: TemplateInput,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateTemplateInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;

  if (input.categoryId) {
    if (!(await assertCategoryOwned(supabase, schoolId, input.categoryId))) {
      return { success: false, error: "Category not found." };
    }
  }

  if (input.id) {
    const owned = await assertTemplateOwned(supabase, schoolId, input.id);
    if (!owned.ok) {
      return { success: false, error: "Template not found." };
    }
    if (owned.status === "retired") {
      return { success: false, error: "Retired templates cannot be edited." };
    }
  }

  const actorId = await getActorId(supabase);
  const payload = {
    school_id: schoolId,
    code: ensureCommCode(input.name, input.code, "TPL"),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    channel: input.channel,
    category_id: input.categoryId || null,
    locale: input.locale?.trim() || "en-IN",
    provider_template_name: input.providerTemplateName?.trim() || null,
    provider_template_locale: input.providerTemplateLocale?.trim() || null,
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("comm_message_templates")
      .update(payload)
      .eq("id", input.id)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Could not update template.",
      };
    }
    revalidate();
    return { success: true, message: "Template updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("comm_message_templates")
    .insert({
      ...payload,
      status: "draft",
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create template.",
    };
  }

  await supabase.from("comm_message_template_versions").insert({
    template_id: data.id,
    version: 1,
    subject: input.channel === "email" ? "" : null,
    body: "",
    placeholders: [],
    is_immutable: false,
    is_current: false,
    change_summary: "Initial draft",
    created_by: actorId,
  });

  revalidate();
  return { success: true, message: "Template created.", id: data.id };
}

export async function listMessageTemplateVersionsAction(
  templateId: string,
): Promise<
  | {
      success: true;
      versions: Array<Record<string, unknown>>;
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

  const { data, error } = await supabase
    .from("comm_message_template_versions")
    .select(
      "id, version, subject, body, placeholders, metadata, change_summary, published_at, is_immutable, is_current",
    )
    .eq("template_id", templateId)
    .order("version", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, versions: data ?? [] };
}

export async function saveMessageTemplateDraftAction(
  input: TemplateVersionInput,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertTemplateOwned(supabase, schoolId, input.templateId);
  if (!owned.ok || !owned.channel) {
    return { success: false, error: "Template not found." };
  }
  if (owned.status === "retired") {
    return { success: false, error: "Retired templates cannot be edited." };
  }

  const placeholders =
    input.placeholders ??
    extractPlaceholders(input.body, input.subject ?? undefined);

  const fieldErrors = validateTemplateVersionInput(
    { ...input, placeholders },
    owned.channel,
  );
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const actorId = await getActorId(supabase);
  const latest = await getLatestTemplateVersion(supabase, input.templateId);
  if (!latest) {
    return { success: false, error: "No template versions found." };
  }

  const content = {
    subject: input.subject?.trim() || null,
    body: input.body.trim(),
    placeholders,
    metadata: input.metadata ?? {},
    change_summary: input.changeSummary?.trim() || latest.change_summary,
  };

  if (!latest.is_immutable) {
    const { data, error } = await supabase
      .from("comm_message_template_versions")
      .update(content)
      .eq("id", latest.id)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Could not save draft.",
      };
    }
    await supabase
      .from("comm_message_templates")
      .update({
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.templateId);
    revalidate();
    return { success: true, message: "Draft saved.", id: data.id };
  }

  const nextVersion = latest.version + 1;
  const { data, error } = await supabase
    .from("comm_message_template_versions")
    .insert({
      template_id: input.templateId,
      version: nextVersion,
      ...content,
      is_immutable: false,
      is_current: false,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not open new draft version.",
    };
  }

  await supabase
    .from("comm_message_templates")
    .update({
      status: "draft",
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.templateId);

  revalidate();
  return {
    success: true,
    message: `Opened draft version ${nextVersion}.`,
    id: data.id,
  };
}

export async function publishMessageTemplateVersionAction(
  templateId: string,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertTemplateOwned(supabase, schoolId, templateId);
  if (!owned.ok || !owned.channel) {
    return { success: false, error: "Template not found." };
  }
  if (owned.status === "retired") {
    return { success: false, error: "Retired templates cannot be published." };
  }

  const latest = await getLatestTemplateVersion(supabase, templateId);
  if (!latest) {
    return { success: false, error: "No template versions found." };
  }

  const fieldErrors = validateTemplateVersionInput(
    {
      templateId,
      subject: latest.subject ?? undefined,
      body: latest.body ?? "",
      placeholders: Array.isArray(latest.placeholders)
        ? (latest.placeholders as string[])
        : [],
    },
    owned.channel,
  );
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Fix template content before publishing.",
      fieldErrors,
    };
  }

  await supabase
    .from("comm_message_template_versions")
    .update({ is_current: false })
    .eq("template_id", templateId)
    .eq("is_current", true);

  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("comm_message_template_versions")
    .update({
      is_immutable: true,
      is_current: true,
      published_at: now,
    })
    .eq("id", latest.id);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase
    .from("comm_message_templates")
    .update({
      status: "published",
      updated_by: actorId,
      updated_at: now,
    })
    .eq("id", templateId);

  revalidate();
  return {
    success: true,
    message: `Template version ${latest.version} published.`,
    id: latest.id,
  };
}

export async function retireMessageTemplateAction(
  templateId: string,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertTemplateOwned(supabase, schoolId, templateId);
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }

  const actorId = await getActorId(supabase);
  await supabase
    .from("comm_message_template_versions")
    .update({ is_current: false })
    .eq("template_id", templateId)
    .eq("is_current", true);

  const { error } = await supabase
    .from("comm_message_templates")
    .update({
      status: "retired",
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  if (error) {
    return { success: false, error: error.message };
  }
  revalidate();
  return { success: true, message: "Template retired.", id: templateId };
}

export async function archiveMessageTemplateAction(
  templateId: string,
): Promise<CommActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertTemplateOwned(supabase, schoolId, templateId);
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }

  const actorId = await getActorId(supabase);
  await supabase
    .from("comm_message_template_versions")
    .update({ is_current: false })
    .eq("template_id", templateId)
    .eq("is_current", true);

  const { error } = await supabase
    .from("comm_message_templates")
    .update({
      archived_at: new Date().toISOString(),
      status: "retired",
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  if (error) {
    return { success: false, error: error.message };
  }
  revalidate();
  return { success: true, message: "Template archived.", id: templateId };
}
