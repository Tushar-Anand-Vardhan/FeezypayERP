export type { PermissionKey } from "@/lib/authz/catalog";
export { PERMISSION_KEYS, isPermissionKey } from "@/lib/authz/catalog";
export {
  SYSTEM_ROLE_BUNDLES,
  SYSTEM_ROLE_CODES,
  ROLE_HIERARCHY,
  canGrantRole,
} from "@/lib/authz/bundles";
export { resolveActor } from "@/lib/authz/resolve-actor";
export { hasPermission } from "@/lib/authz/evaluate";
export {
  requirePermission,
  requireAnyPermission,
  requireApproval,
} from "@/lib/authz/require";
export {
  getAuthzBootstrap,
  getAppHeaderAuth,
  canInBootstrap,
  canAnyInBootstrap,
} from "@/lib/authz/bootstrap";
export type {
  AuthzBootstrap,
  AppHeaderAuthProps,
} from "@/lib/authz/bootstrap-shared";
export { Can } from "@/lib/authz/can";
export {
  listPermissionCatalogAction,
  listSchoolRolesAction,
  createCustomRoleAction,
  grantRoleAction,
  revokeRoleGrantAction,
} from "@/lib/authz/actions";
