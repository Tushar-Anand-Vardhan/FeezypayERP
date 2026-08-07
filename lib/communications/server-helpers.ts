import type { createClient } from "@/lib/supabase/server";
import type { CommChannel } from "@/lib/communications/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function assertCategoryOwned(
  supabase: Supabase,
  schoolId: string,
  categoryId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("comm_announcement_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertPriorityOwned(
  supabase: Supabase,
  schoolId: string,
  priorityId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("comm_priority_levels")
    .select("id")
    .eq("id", priorityId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertAudienceGroupOwned(
  supabase: Supabase,
  schoolId: string,
  groupId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("comm_audience_groups")
    .select("id")
    .eq("id", groupId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertTemplateOwned(
  supabase: Supabase,
  schoolId: string,
  templateId: string,
  options?: { allowArchived?: boolean },
): Promise<{ ok: boolean; status?: string; channel?: CommChannel }> {
  let query = supabase
    .from("comm_message_templates")
    .select("id, status, channel")
    .eq("id", templateId)
    .eq("school_id", schoolId);

  if (!options?.allowArchived) {
    query = query.is("archived_at", null);
  }

  const { data } = await query.maybeSingle();
  if (!data) {
    return { ok: false };
  }
  return {
    ok: true,
    status: data.status,
    channel: data.channel as CommChannel,
  };
}

export async function assertDeliveryRuleOwned(
  supabase: Supabase,
  schoolId: string,
  ruleId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("comm_delivery_rules")
    .select("id")
    .eq("id", ruleId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function getLatestTemplateVersion(
  supabase: Supabase,
  templateId: string,
) {
  const { data } = await supabase
    .from("comm_message_template_versions")
    .select(
      "id, version, subject, body, placeholders, metadata, change_summary, published_at, is_immutable, is_current",
    )
    .eq("template_id", templateId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
