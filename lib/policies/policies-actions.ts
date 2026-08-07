"use server";

import { revalidatePath } from "next/cache";
import { defaultRulesForKind } from "@/lib/policies/defaults";
import {
  assertPolicyOwned,
  assertYearOwned,
  getActorId,
  getCurrentVersion,
  getLatestVersion,
} from "@/lib/policies/server-helpers";
import type {
  PolicyActionResult,
  PolicyInput,
  PolicyKind,
  PolicyVersionInput,
} from "@/lib/policies/types";
import {
  ensurePolicyCode,
  mergeDefaultRules,
  validatePolicyInput,
  validatePolicyVersionInput,
} from "@/lib/policies/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/policies");
}

const POLICY_SELECT =
  "id, policy_kind, code, name, description, academic_year_id, status, archived_at, created_at, updated_at";

export async function listSchoolPoliciesAction(options?: {
  includeArchived?: boolean;
  policyKind?: PolicyKind;
  academicYearId?: string | null;
}): Promise<
  | { success: true; policies: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("school_policies")
    .select(POLICY_SELECT)
    .eq("school_id", schoolId)
    .order("policy_kind", { ascending: true })
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (options?.policyKind) {
    query = query.eq("policy_kind", options.policyKind);
  }
  if (options?.academicYearId === null) {
    query = query.is("academic_year_id", null);
  } else if (options?.academicYearId) {
    query = query.eq("academic_year_id", options.academicYearId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, policies: data ?? [] };
}

export async function upsertSchoolPolicyAction(
  input: PolicyInput,
): Promise<PolicyActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validatePolicyInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const academicYearId = input.academicYearId?.trim() || null;

  if (academicYearId) {
    if (!(await assertYearOwned(supabase, schoolId, academicYearId))) {
      return { success: false, error: "Academic year not found." };
    }
  }

  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();

  if (input.id) {
    const owned = await assertPolicyOwned(supabase, schoolId, input.id);
    if (!owned.ok) {
      return { success: false, error: "Policy not found." };
    }
    if (owned.status === "retired") {
      return { success: false, error: "Retired policies cannot be edited." };
    }

    const { data, error } = await supabase
      .from("school_policies")
      .update({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        code: ensurePolicyCode(input.policyKind, input.name, input.code),
        updated_by: actorId,
        updated_at: now,
      })
      .eq("id", input.id)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Could not update policy.",
      };
    }

    revalidate();
    return { success: true, message: "Policy updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("school_policies")
    .insert({
      school_id: schoolId,
      policy_kind: input.policyKind,
      code: ensurePolicyCode(input.policyKind, input.name, input.code),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      academic_year_id: academicYearId,
      status: "draft",
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create policy.",
    };
  }

  const { error: versionError } = await supabase
    .from("school_policy_versions")
    .insert({
      policy_id: data.id,
      version: 1,
      rules: defaultRulesForKind(input.policyKind),
      is_immutable: false,
      is_current: false,
      change_summary: "Initial draft",
      created_by: actorId,
    });

  if (versionError) {
    return { success: false, error: versionError.message };
  }

  revalidate();
  return { success: true, message: "Policy created.", id: data.id };
}

export async function listSchoolPolicyVersionsAction(
  policyId: string,
): Promise<
  | {
      success: true;
      versions: Array<{
        id: string;
        version: number;
        rules: unknown;
        effective_from: string | null;
        effective_to: string | null;
        change_summary: string | null;
        published_at: string | null;
        is_immutable: boolean;
        is_current: boolean;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertPolicyOwned(supabase, schoolId, policyId, {
    allowArchived: true,
  });
  if (!owned.ok) {
    return { success: false, error: "Policy not found." };
  }

  const { data, error } = await supabase
    .from("school_policy_versions")
    .select(
      "id, version, rules, effective_from, effective_to, change_summary, published_at, is_immutable, is_current",
    )
    .eq("policy_id", policyId)
    .order("version", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, versions: data ?? [] };
}

/**
 * Save rules onto the latest draft version, or open version N+1 if latest is immutable.
 */
export async function saveSchoolPolicyDraftRulesAction(
  input: PolicyVersionInput,
): Promise<PolicyActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertPolicyOwned(supabase, schoolId, input.policyId);
  if (!owned.ok || !owned.policyKind) {
    return { success: false, error: "Policy not found." };
  }
  if (owned.status === "retired") {
    return { success: false, error: "Retired policies cannot be edited." };
  }

  const fieldErrors = validatePolicyVersionInput(owned.policyKind, input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const actorId = await getActorId(supabase);
  const rules = mergeDefaultRules(owned.policyKind, input.rules);
  const latest = await getLatestVersion(supabase, input.policyId);

  if (!latest) {
    return { success: false, error: "No policy versions found." };
  }

  if (!latest.is_immutable) {
    const { data, error } = await supabase
      .from("school_policy_versions")
      .update({
        rules,
        effective_from: input.effectiveFrom || null,
        effective_to: input.effectiveTo || null,
        change_summary: input.changeSummary?.trim() || latest.change_summary,
      })
      .eq("id", latest.id)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Could not update draft rules.",
      };
    }

    await supabase
      .from("school_policies")
      .update({
        updated_by: actorId,
        updated_at: new Date().toISOString(),
        status: owned.status === "published" ? "published" : "draft",
      })
      .eq("id", input.policyId);

    revalidate();
    return { success: true, message: "Draft rules saved.", id: data.id };
  }

  const nextVersion = latest.version + 1;
  const { data, error } = await supabase
    .from("school_policy_versions")
    .insert({
      policy_id: input.policyId,
      version: nextVersion,
      rules,
      effective_from: input.effectiveFrom || null,
      effective_to: input.effectiveTo || null,
      change_summary: input.changeSummary?.trim() || `Draft v${nextVersion}`,
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
    .from("school_policies")
    .update({
      status: "draft",
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.policyId);

  revalidate();
  return {
    success: true,
    message: `Opened draft version ${nextVersion}.`,
    id: data.id,
  };
}

export async function publishSchoolPolicyVersionAction(
  policyId: string,
  options?: { versionId?: string },
): Promise<PolicyActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertPolicyOwned(supabase, schoolId, policyId);
  if (!owned.ok || !owned.policyKind) {
    return { success: false, error: "Policy not found." };
  }
  if (owned.status === "retired") {
    return { success: false, error: "Retired policies cannot be published." };
  }

  let target = options?.versionId
    ? (
        await supabase
          .from("school_policy_versions")
          .select(
            "id, version, rules, is_immutable, effective_from, effective_to",
          )
          .eq("id", options.versionId)
          .eq("policy_id", policyId)
          .maybeSingle()
      ).data
    : await getLatestVersion(supabase, policyId);

  if (!target) {
    return { success: false, error: "Policy version not found." };
  }

  const fieldErrors = validatePolicyVersionInput(owned.policyKind, {
    policyId,
    rules: (target.rules as Record<string, unknown>) ?? {},
    effectiveFrom: target.effective_from,
    effectiveTo: target.effective_to,
  });
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Fix rule validation errors before publishing.",
      fieldErrors,
    };
  }

  // Clear previous current
  await supabase
    .from("school_policy_versions")
    .update({ is_current: false })
    .eq("policy_id", policyId)
    .eq("is_current", true);

  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("school_policy_versions")
    .update({
      is_immutable: true,
      is_current: true,
      published_at: now,
    })
    .eq("id", target.id);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase
    .from("school_policies")
    .update({
      status: "published",
      updated_by: actorId,
      updated_at: now,
    })
    .eq("id", policyId);

  revalidate();
  return {
    success: true,
    message: `Policy version ${target.version} published.`,
    id: target.id,
  };
}

export async function getCurrentSchoolPolicyAction(
  policyKind: PolicyKind,
  academicYearId?: string | null,
): Promise<
  | {
      success: true;
      policy: Record<string, unknown> | null;
      version: Record<string, unknown> | null;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  // Prefer year-scoped policy, else school-wide
  let policyQuery = supabase
    .from("school_policies")
    .select(POLICY_SELECT)
    .eq("school_id", schoolId)
    .eq("policy_kind", policyKind)
    .is("archived_at", null)
    .eq("status", "published");

  if (academicYearId) {
    const { data: yearPolicy } = await policyQuery
      .eq("academic_year_id", academicYearId)
      .maybeSingle();
    if (yearPolicy) {
      const version = await getCurrentVersion(supabase, yearPolicy.id);
      return { success: true, policy: yearPolicy, version };
    }
  }

  const { data: schoolPolicy, error } = await supabase
    .from("school_policies")
    .select(POLICY_SELECT)
    .eq("school_id", schoolId)
    .eq("policy_kind", policyKind)
    .is("archived_at", null)
    .is("academic_year_id", null)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }
  if (!schoolPolicy) {
    return { success: true, policy: null, version: null };
  }

  const version = await getCurrentVersion(supabase, schoolPolicy.id);
  return { success: true, policy: schoolPolicy, version };
}

export async function retireSchoolPolicyAction(
  policyId: string,
): Promise<PolicyActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertPolicyOwned(supabase, schoolId, policyId);
  if (!owned.ok) {
    return { success: false, error: "Policy not found." };
  }

  const actorId = await getActorId(supabase);
  await supabase
    .from("school_policy_versions")
    .update({ is_current: false })
    .eq("policy_id", policyId)
    .eq("is_current", true);

  const { error } = await supabase
    .from("school_policies")
    .update({
      status: "retired",
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", policyId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Policy retired.", id: policyId };
}

export async function archiveSchoolPolicyAction(
  policyId: string,
): Promise<PolicyActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertPolicyOwned(supabase, schoolId, policyId);
  if (!owned.ok) {
    return { success: false, error: "Policy not found." };
  }

  const actorId = await getActorId(supabase);
  await supabase
    .from("school_policy_versions")
    .update({ is_current: false })
    .eq("policy_id", policyId)
    .eq("is_current", true);

  const { error } = await supabase
    .from("school_policies")
    .update({
      archived_at: new Date().toISOString(),
      status: "retired",
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", policyId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Policy archived.", id: policyId };
}

/**
 * Ensure school-wide defaults exist with filled default rules (idempotent for empty {}).
 */
export async function ensureDefaultSchoolPoliciesAction(): Promise<PolicyActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: policies, error } = await supabase
    .from("school_policies")
    .select("id, policy_kind")
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .is("academic_year_id", null);

  if (error) {
    return { success: false, error: error.message };
  }

  for (const policy of policies ?? []) {
    const latest = await getLatestVersion(supabase, policy.id);
    if (
      latest &&
      !latest.is_immutable &&
      latest.rules &&
      typeof latest.rules === "object" &&
      Object.keys(latest.rules as object).length === 0
    ) {
      await supabase
        .from("school_policy_versions")
        .update({
          rules: defaultRulesForKind(policy.policy_kind as PolicyKind),
          change_summary: "Applied default rules",
        })
        .eq("id", latest.id);
    }
  }

  revalidate();
  return { success: true, message: "Default policies ready." };
}
