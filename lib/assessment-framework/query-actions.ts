"use server";

import {
  assertFrameworkOwned,
  getCurrentFrameworkVersion,
  loadFrameworkTree,
} from "@/lib/assessment-framework/server-helpers";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function getFrameworkTreeAction(
  frameworkId: string,
): Promise<
  | {
      success: true;
      tree: NonNullable<Awaited<ReturnType<typeof loadFrameworkTree>>>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_framework.read",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const tree = await loadFrameworkTree(supabase, schoolId, frameworkId);
  if (!tree) return { success: false, error: "Framework not found" };
  return { success: true, tree };
}

export async function listFrameworkVersionsAction(
  frameworkId: string,
): Promise<
  | { success: true; versions: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_framework.read",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertFrameworkOwned(supabase, schoolId, frameworkId, {
    allowArchived: true,
  });
  if (!owned.ok) return { success: false, error: "Framework not found" };

  const { data, error } = await supabase
    .from("assessment_framework_versions")
    .select(
      "id, version, change_summary, published_at, is_immutable, is_current, created_at",
    )
    .eq("framework_id", frameworkId)
    .order("version", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, versions: data ?? [] };
}

export async function getCurrentFrameworkVersionAction(
  frameworkId: string,
): Promise<
  | { success: true; version: Record<string, unknown> | null }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_framework.read",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertFrameworkOwned(supabase, schoolId, frameworkId);
  if (!owned.ok) return { success: false, error: "Framework not found" };

  const version = await getCurrentFrameworkVersion(supabase, frameworkId);
  return { success: true, version: version as Record<string, unknown> | null };
}
