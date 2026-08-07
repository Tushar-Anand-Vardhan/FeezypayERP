import type { SupabaseClient } from "@supabase/supabase-js";

export type OnboardingStatus = "in_progress" | "completed";

export const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/signup/confirm",
  "/reset-password",
  "/invite/accept",
  "/activate/profile",
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

export function isActivateRoute(pathname: string) {
  return (
    pathname === "/activate/profile" ||
    pathname.startsWith("/activate/profile/")
  );
}

export function isInviteAcceptRoute(pathname: string) {
  return pathname === "/invite/accept" || pathname.startsWith("/invite/accept/");
}

export function isProtectedAppRoute(pathname: string) {
  return (
    isDashboardRoute(pathname) ||
    isOnboardingRoute(pathname) ||
    isActivateRoute(pathname) ||
    isInviteAcceptRoute(pathname)
  );
}

export function getPostAuthDestination(
  onboardingStatus: OnboardingStatus | null,
  options?: {
    needsProfileCompletion?: boolean;
    isSchoolAdmin?: boolean;
    hasMembership?: boolean;
  },
): string {
  if (options?.needsProfileCompletion) {
    return "/activate/profile";
  }

  if (options?.isSchoolAdmin) {
    if (onboardingStatus === "completed") {
      return "/dashboard";
    }
    return "/onboarding";
  }

  if (options?.hasMembership) {
    return "/dashboard";
  }

  // Invited user mid-bind
  if (onboardingStatus === "completed") {
    return "/dashboard";
  }

  // Legacy admin without flags
  if (onboardingStatus === null) {
    return "/invite/accept";
  }

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

export async function fetchAuthGateState(supabase: SupabaseClient): Promise<{
  onboardingStatus: OnboardingStatus | null;
  needsProfileCompletion: boolean;
  isSchoolAdmin: boolean;
  hasMembership: boolean;
  personBound: boolean;
}> {
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (typeof userId !== "string") {
    return {
      onboardingStatus: null,
      needsProfileCompletion: false,
      isSchoolAdmin: false,
      hasMembership: false,
      personBound: false,
    };
  }

  const onboardingStatus = await fetchUserOnboardingStatus(supabase);

  const { data: person } = await supabase
    .from("persons")
    .select("id, profile_completed_at")
    .eq("auth_user_id", userId)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  let hasMembership = Boolean(profile?.id);
  try {
    const { data: schools } = await supabase.rpc("membership_schools");
    if (Array.isArray(schools) && schools.length > 0) {
      hasMembership = true;
    }
  } catch {
    // RPC may not exist until migration applied
  }

  const isSchoolAdmin = profile?.role === "school_admin";
  const personBound = Boolean(person?.id);
  const needsProfileCompletion = Boolean(
    personBound && person && person.profile_completed_at == null,
  );

  return {
    onboardingStatus,
    needsProfileCompletion,
    isSchoolAdmin,
    hasMembership: hasMembership || personBound,
    personBound,
  };
}

export function resolveAuthenticatedRouteRedirect(
  pathname: string,
  onboardingStatus: OnboardingStatus | null,
  gate?: {
    needsProfileCompletion?: boolean;
    isSchoolAdmin?: boolean;
    hasMembership?: boolean;
    personBound?: boolean;
  },
): string | null {
  // Allow activate + invite accept to proceed
  if (isActivateRoute(pathname) || isInviteAcceptRoute(pathname)) {
    if (gate?.needsProfileCompletion && isInviteAcceptRoute(pathname)) {
      return null;
    }
    if (
      !gate?.needsProfileCompletion &&
      isActivateRoute(pathname) &&
      gate?.personBound
    ) {
      return getPostAuthDestination(onboardingStatus, gate);
    }
    return null;
  }

  if (pathname === "/onboarding") {
    return null;
  }

  // Force profile completion for bound persons
  if (
    gate?.needsProfileCompletion &&
    !isActivateRoute(pathname) &&
    !isInviteAcceptRoute(pathname)
  ) {
    return "/activate/profile";
  }

  if (isAuthRoute(pathname)) {
    // Don't bounce invite/activate auth routes
    if (isActivateRoute(pathname) || isInviteAcceptRoute(pathname)) {
      return null;
    }
    return getPostAuthDestination(onboardingStatus, gate);
  }

  if (isOnboardingRoute(pathname) && onboardingStatus === "completed") {
    return "/dashboard";
  }

  // Non-admin with membership should not be forced into school onboarding
  if (
    isOnboardingRoute(pathname) &&
    gate &&
    !gate.isSchoolAdmin &&
    gate.hasMembership
  ) {
    return "/dashboard";
  }

  return null;
}
