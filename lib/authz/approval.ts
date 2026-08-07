import { hasPermission } from "@/lib/authz/evaluate";
import type { PermissionKey } from "@/lib/authz/catalog";
import type { AuthzActor, AuthzAttrs, AuthzDecision } from "@/lib/authz/types";

const APPROVE_SUFFIX = ".approve";
const LOCK_SUFFIX = ".lock";
const PUBLISH_SUFFIX = ".publish";

export function isApprovalKey(key: PermissionKey): boolean {
  return (
    key.endsWith(APPROVE_SUFFIX) ||
    key.endsWith(LOCK_SUFFIX) ||
    key.endsWith(PUBLISH_SUFFIX) ||
    key.endsWith(".unlock")
  );
}

export function requireApprovalPermission(
  actor: AuthzActor,
  key: PermissionKey,
  attrs?: AuthzAttrs,
): AuthzDecision {
  if (!isApprovalKey(key)) {
    return {
      allow: false,
      reason: `Not an approval/lock/publish key: ${key}`,
    };
  }
  return hasPermission(actor, key, attrs);
}
