"use server";

import { buildPrincipalDashboard } from "@/lib/principal-dashboard/dashboard";
import type { PrincipalDashboardActionResult } from "@/lib/principal-dashboard/types";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function getPrincipalDashboardAction(input?: {
  asOfDate?: string;
  academicYearId?: string;
}): Promise<PrincipalDashboardActionResult> {
  const context = await getAuthenticatedSchoolContext("analytics.dashboard.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();

  try {
    const dashboard = await buildPrincipalDashboard(
      supabase,
      schoolId,
      school?.name ?? null,
      {
        asOfDate: input?.asOfDate,
        academicYearId: input?.academicYearId,
      },
    );
    return { success: true, dashboard };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to build dashboard.",
    };
  }
}
