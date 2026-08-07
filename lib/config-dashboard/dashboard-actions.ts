"use server";

import { buildConfigurationDashboard } from "@/lib/config-dashboard/health";
import type { ConfigurationDashboardResult } from "@/lib/config-dashboard/types";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

/** School setup command centre — completion, warnings, deps, health. */
export async function getConfigurationDashboardAction(): Promise<ConfigurationDashboardResult> {
  const ctx = await getAuthenticatedSchoolContext();
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  try {
    const { summary, modules } = await buildConfigurationDashboard(
      ctx.supabase,
      ctx.schoolId,
    );
    return { success: true, summary, modules };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to build configuration dashboard.";
    return { success: false, error: message };
  }
}
