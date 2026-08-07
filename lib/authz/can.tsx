"use client";

import type { ReactNode } from "react";
import type { PermissionKey } from "@/lib/authz/catalog";
import type { AuthzBootstrap } from "@/lib/authz/bootstrap";
import { canInBootstrap } from "@/lib/authz/bootstrap";

type CanProps = {
  permission: PermissionKey | PermissionKey[];
  bootstrap: AuthzBootstrap | null | undefined;
  children: ReactNode;
  fallback?: ReactNode;
};

/** Render children only when bootstrap includes the permission key(s). */
export function Can({
  permission,
  bootstrap,
  children,
  fallback = null,
}: CanProps) {
  const keys = Array.isArray(permission) ? permission : [permission];
  const ok = keys.some((k) => canInBootstrap(bootstrap, k));
  if (!ok) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
