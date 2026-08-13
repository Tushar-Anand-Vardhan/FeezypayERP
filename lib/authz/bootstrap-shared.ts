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
