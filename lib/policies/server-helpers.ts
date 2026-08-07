import type { createClient } from "@/lib/supabase/server";
import type { PolicyKind } from "@/lib/policies/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function assertYearOwned(
  supabase: Supabase,
  schoolId: string,
  academicYearId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", academicYearId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertPolicyOwned(
  supabase: Supabase,
  schoolId: string,
  policyId: string,
  options?: { allowArchived?: boolean },
): Promise<{
  ok: boolean;
  status?: string;
  policyKind?: PolicyKind;
}> {
  let query = supabase
    .from("school_policies")
    .select("id, status, policy_kind")
    .eq("id", policyId)
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
    policyKind: data.policy_kind as PolicyKind,
  };
}

export async function getLatestVersion(
  supabase: Supabase,
  policyId: string,
) {
  const { data } = await supabase
    .from("school_policy_versions")
    .select(
      "id, version, rules, effective_from, effective_to, change_summary, published_at, is_immutable, is_current",
    )
    .eq("policy_id", policyId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getCurrentVersion(
  supabase: Supabase,
  policyId: string,
) {
  const { data } = await supabase
    .from("school_policy_versions")
    .select(
      "id, version, rules, effective_from, effective_to, change_summary, published_at, is_immutable, is_current",
    )
    .eq("policy_id", policyId)
    .eq("is_current", true)
    .maybeSingle();
  return data;
}
