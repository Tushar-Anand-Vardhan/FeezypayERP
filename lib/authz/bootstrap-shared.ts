import type { AuthMembership, AuthPersona } from "@/lib/auth/types";
import type { PermissionKey } from "@/lib/authz/catalog";

/** Client-safe AuthZ snapshot (no server imports). */
export type AuthzBootstrap = {
  schoolId: string;
  persona: string;
  permissions: PermissionKey[];
  isSchoolAdmin: boolean;
};

export type AppHeaderAuthProps = {
  memberships: AuthMembership[];
  activeSchoolId: string | null;
  activePersona: AuthPersona | null;
  authz: AuthzBootstrap | null;
};

export function canInBootstrap(
  bootstrap: AuthzBootstrap | null | undefined,
  key: PermissionKey,
): boolean {
  return Boolean(bootstrap?.permissions.includes(key));
}

export function canAnyInBootstrap(
  bootstrap: AuthzBootstrap | null | undefined,
  key: PermissionKey | PermissionKey[],
): boolean {
  const keys = Array.isArray(key) ? key : [key];
  return keys.some((item) => canInBootstrap(bootstrap, item));
}

export function authzBootstrapFromActor(actor: {
  schoolId: string;
  activePersona: string;
  permissionKeys: Iterable<PermissionKey>;
  isSchoolAdmin: boolean;
}): AuthzBootstrap {
  return {
    schoolId: actor.schoolId,
    persona: String(actor.activePersona),
    permissions: [...actor.permissionKeys],
    isSchoolAdmin: actor.isSchoolAdmin,
  };
}
