import type { SupabaseClient } from "@supabase/supabase-js";

export type OnboardingStatus = "in_progress" | "completed";

export const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/signup/confirm",
] as const;

export function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function isDashboardRoute(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

export function isOnboardingRoute(pathname: string) {
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}

export function isProtectedAppRoute(pathname: string) {
  return isDashboardRoute(pathname) || isOnboardingRoute(pathname);
}

export function getPostAuthDestination(
  onboardingStatus: OnboardingStatus | null,
): "/dashboard" | "/onboarding" {
  if (onboardingStatus === "completed") {
    return "/dashboard";
  }

  // `/onboarding` resolves to the earliest incomplete step.
  return "/onboarding";
}

export async function fetchUserOnboardingStatus(
  supabase: SupabaseClient,
): Promise<OnboardingStatus | null> {
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (typeof userId !== "string") {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile?.school_id) {
    return null;
  }

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("onboarding_status")
    .eq("id", profile.school_id)
    .maybeSingle();

  if (schoolError || !school?.onboarding_status) {
    return null;
  }

  return school.onboarding_status as OnboardingStatus;
}

export function resolveAuthenticatedRouteRedirect(
  pathname: string,
  onboardingStatus: OnboardingStatus | null,
): string | null {
  if (pathname === "/onboarding") {
    // Let the onboarding index page compute the resume step.
    return null;
  }

  if (isAuthRoute(pathname)) {
    return getPostAuthDestination(onboardingStatus);
  }

  // Dashboard is reachable during onboarding (Save & Exit). Features stay locked in UI.
  if (isOnboardingRoute(pathname) && onboardingStatus === "completed") {
    return "/dashboard";
  }

  return null;
}
