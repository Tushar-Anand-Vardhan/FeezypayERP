import { cache } from "react";
import { getAuthBootstrapAction } from "@/lib/auth/session-context";
import { resolveActor } from "@/lib/authz/resolve-actor";
import type {
  AppHeaderAuthProps,
  AuthzBootstrap,
} from "@/lib/authz/bootstrap-shared";

export type {
  AppHeaderAuthProps,
  AuthzBootstrap,
} from "@/lib/authz/bootstrap-shared";
export { canInBootstrap, canAnyInBootstrap } from "@/lib/authz/bootstrap-shared";

export const getAuthzBootstrap = cache(async (): Promise<
  { success: true; data: AuthzBootstrap } | { success: false; error: string }
> => {
  const resolved = await resolveActor();
  if (!resolved.ok) {
    return { success: false, error: resolved.error };
  }
  return {
    success: true,
    data: {
      schoolId: resolved.actor.schoolId,
      persona: String(resolved.actor.activePersona),
      permissions: [...resolved.actor.permissionKeys],
      isSchoolAdmin: resolved.actor.isSchoolAdmin,
    },
  };
});

/** Membership + permission bootstrap — memoized once per request. */
export const getAppHeaderAuth = cache(async (): Promise<AppHeaderAuthProps> => {
  const [authBoot, authzBoot] = await Promise.all([
    getAuthBootstrapAction(),
    getAuthzBootstrap(),
  ]);

  return {
    memberships: authBoot.success ? authBoot.data.memberships : [],
    activeSchoolId: authBoot.success
      ? (authBoot.data.activeContext?.schoolId ?? null)
      : null,
    activePersona: authBoot.success
      ? (authBoot.data.activeContext?.persona ?? null)
      : null,
    authz: authzBoot.success ? authzBoot.data : null,
  };
});
