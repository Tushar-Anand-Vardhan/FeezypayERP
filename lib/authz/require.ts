import { hasPermission } from "@/lib/authz/evaluate";
import { combineOwnership } from "@/lib/authz/ownership";
import { requireApprovalPermission } from "@/lib/authz/approval";
import { resolveActor } from "@/lib/authz/resolve-actor";
import { isPermissionKey, type PermissionKey } from "@/lib/authz/catalog";
import type { AuthzAttrs, AuthzContext } from "@/lib/authz/types";

export type RequirePermissionResult =
  | AuthzContext
  | { error: string };

/**
 * Assert permission key (+ optional ABAC attrs). Use in every server action.
 */
export async function requirePermission(
  key: PermissionKey | string,
  attrs?: AuthzAttrs,
): Promise<RequirePermissionResult> {
  if (!isPermissionKey(key)) {
    return { error: `Unknown permission key: ${key}` };
  }

  const resolved = await resolveActor({
    schoolId: attrs?.schoolId,
  });
  if (!resolved.ok) {
    return { error: resolved.error };
  }

  const { supabase, actor } = resolved;
  const schoolId = attrs?.schoolId ?? actor.schoolId;

  const decision = hasPermission(actor, key, {
    ...attrs,
    schoolId,
  });
  if (!decision.allow) {
    await logDeny(supabase, actor.authUserId, schoolId, key, decision.reason);
    return { error: decision.reason };
  }

  const ownership = combineOwnership(actor, attrs);
  if (!ownership.allow) {
    await logDeny(
      supabase,
      actor.authUserId,
      schoolId,
      key,
      ownership.reason,
    );
    return { error: ownership.reason };
  }

  return {
    supabase,
    schoolId,
    actor: { ...actor, schoolId },
  };
}

export async function requireAnyPermission(
  keys: PermissionKey[],
  attrs?: AuthzAttrs,
): Promise<RequirePermissionResult> {
  let lastError = "Missing required permission.";
  for (const key of keys) {
    const result = await requirePermission(key, attrs);
    if (!("error" in result)) {
      return result;
    }
    lastError = result.error;
  }
  return { error: lastError };
}

export async function requireApproval(
  key: PermissionKey,
  attrs?: AuthzAttrs,
): Promise<RequirePermissionResult> {
  const resolved = await resolveActor({ schoolId: attrs?.schoolId });
  if (!resolved.ok) {
    return { error: resolved.error };
  }
  const decision = requireApprovalPermission(resolved.actor, key, attrs);
  if (!decision.allow) {
    return { error: decision.reason };
  }
  return requirePermission(key, attrs);
}

async function logDeny(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  authUserId: string,
  schoolId: string,
  key: string,
  reason: string,
) {
  try {
    await supabase.from("authz_audit_log").insert({
      school_id: schoolId,
      actor_auth_user_id: authUserId,
      action: "permission.deny",
      detail: { key, reason },
    });
  } catch {
    // Audit table may not exist until migration; ignore
  }
}
