"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import { DEFAULT_ONBOARDING_PATH } from "@/lib/onboarding/steps";

export const RESET_ONBOARDING_CONFIRMATION = "RESET";

type Result =
  | { success: true; redirectTo: string }
  | { success: false; error: string };

export async function resetOnboardingAction(
  confirmation: string,
): Promise<Result> {
  const context = await getAuthenticatedSchoolContext("tenant.school.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  if (!context.actor?.isSchoolAdmin) {
    return {
      success: false,
      error: "Only the school admin can reset onboarding.",
    };
  }

  if (confirmation.trim().toUpperCase() !== RESET_ONBOARDING_CONFIRMATION) {
    return {
      success: false,
      error: `Type ${RESET_ONBOARDING_CONFIRMATION} to confirm.`,
    };
  }

  const { error } = await context.supabase.rpc("reset_school_onboarding", {
    p_school_id: context.schoolId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/onboarding", "layout");
  revalidatePath("/dashboard", "layout");
  return { success: true, redirectTo: DEFAULT_ONBOARDING_PATH };
}
