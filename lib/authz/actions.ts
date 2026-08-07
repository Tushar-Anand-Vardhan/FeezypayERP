"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz/require";
import {
  SYSTEM_ROLE_BUNDLES,
  canGrantRole,
  type SystemRoleCode,
} from "@/lib/authz/bundles";
import { isPermissionKey, type PermissionKey } from "@/lib/authz/catalog";
import { PERMISSION_KEYS } from "@/lib/authz/catalog";

type Result =
  | { success: true; id?: string }
  | { success: false; error: string };

export async function listPermissionCatalogAction() {
  const ctx = await requirePermission("authz.role.read");
  if ("error" in ctx) {
    return { success: false as const, error: ctx.error };
  }
  return {
    success: true as const,
    permissions: [...PERMISSION_KEYS],
    bundles: SYSTEM_ROLE_BUNDLES,
  };
}

export async function listSchoolRolesAction() {
  const ctx = await requirePermission("authz.role.read");
  if ("error" in ctx) {
    return { success: false as const, error: ctx.error };
  }
  const { data, error } = await ctx.supabase
    .from("authz_roles")
    .select("id, code, name, is_system, school_id, archived_at")
    .or(`school_id.eq.${ctx.schoolId},is_system.eq.true`)
    .is("archived_at", null)
    .order("is_system", { ascending: false });

  if (error) {
    return { success: false as const, error: error.message };
  }
  return { success: true as const, roles: data ?? [] };
}

export async function createCustomRoleAction(input: {
  code: string;
  name: string;
  permissionKeys: string[];
}): Promise<Result> {
  const ctx = await requirePermission("authz.role.create_custom");
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  const code = input.code.trim().toLowerCase().replace(/\s+/g, "_");
  if (!code || code === "school_admin") {
    return { success: false, error: "Invalid custom role code." };
  }

  const allowed = new Set(SYSTEM_ROLE_BUNDLES.school_admin);
  const keys: PermissionKey[] = [];
  for (const k of input.permissionKeys) {
    if (!isPermissionKey(k) || !allowed.has(k)) {
      return {
        success: false,
        error: `Cannot attach permission: ${k}`,
      };
    }
    keys.push(k);
  }

  const { data: role, error } = await ctx.supabase
    .from("authz_roles")
    .insert({
      code,
      name: input.name.trim() || code,
      is_system: false,
      school_id: ctx.schoolId,
    })
    .select("id")
    .single();

  if (error || !role) {
    return { success: false, error: error?.message ?? "Could not create role." };
  }

  if (keys.length > 0) {
    await ctx.supabase.from("authz_role_permissions").insert(
      keys.map((permission_key) => ({
        role_id: role.id,
        permission_key,
      })),
    );
  }

  await ctx.supabase.from("authz_audit_log").insert({
    school_id: ctx.schoolId,
    actor_auth_user_id: ctx.actor.authUserId,
    action: "role.create_custom",
    detail: { roleId: role.id, code, keys },
  });

  revalidatePath("/dashboard");
  return { success: true, id: role.id };
}

export async function grantRoleAction(input: {
  personId: string;
  roleId: string;
  expiresAt?: string | null;
}): Promise<Result> {
  const ctx = await requirePermission("authz.role.grant");
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  const { data: role } = await ctx.supabase
    .from("authz_roles")
    .select("id, code, is_system, school_id")
    .eq("id", input.roleId)
    .maybeSingle();

  if (!role) {
    return { success: false, error: "Role not found." };
  }
  if (role.code === "school_admin") {
    return { success: false, error: "Cannot grant school_admin via this API." };
  }
  if (!role.is_system && role.school_id !== ctx.schoolId) {
    return { success: false, error: "Role is not in this school." };
  }

  const granter = ctx.actor.systemRoles.includes("school_admin")
    ? "school_admin"
    : ctx.actor.systemRoles.includes("principal")
      ? "principal"
      : null;
  if (!granter) {
    return { success: false, error: "Only Admin/Principal may grant roles." };
  }

  if (role.is_system) {
    const target = role.code as SystemRoleCode;
    if (!canGrantRole(granter, target)) {
      return { success: false, error: "Cannot grant a role at or above your level." };
    }
  }

  const { error } = await ctx.supabase.from("authz_member_role_grants").insert({
    person_id: input.personId,
    school_id: ctx.schoolId,
    role_id: input.roleId,
    granted_by: ctx.actor.authUserId,
    expires_at: input.expiresAt ?? null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  await ctx.supabase.from("authz_audit_log").insert({
    school_id: ctx.schoolId,
    actor_auth_user_id: ctx.actor.authUserId,
    action: "role.grant",
    detail: { personId: input.personId, roleId: input.roleId },
  });

  revalidatePath("/dashboard");
  return { success: true };
}

export async function revokeRoleGrantAction(grantId: string): Promise<Result> {
  const ctx = await requirePermission("authz.role.revoke");
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  const { error } = await ctx.supabase
    .from("authz_member_role_grants")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: ctx.actor.authUserId,
    })
    .eq("id", grantId)
    .eq("school_id", ctx.schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  await ctx.supabase.from("authz_audit_log").insert({
    school_id: ctx.schoolId,
    actor_auth_user_id: ctx.actor.authUserId,
    action: "role.revoke",
    detail: { grantId },
  });

  revalidatePath("/dashboard");
  return { success: true };
}
