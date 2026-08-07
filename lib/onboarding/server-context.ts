import { requirePermission } from "@/lib/authz/require";
import type { AuthzAttrs } from "@/lib/authz/types";
import type { PermissionKey } from "@/lib/authz/catalog";

/**
 * School context for server actions.
 * Defaults to tenant.school.read; pass `permission` for specific keys.
 */
export async function getAuthenticatedSchoolContext(
  permission: PermissionKey = "tenant.school.read",
  attrs?: AuthzAttrs,
):
  Promise<
    | {
        supabase: Awaited<
          ReturnType<typeof import("@/lib/supabase/server").createClient>
        >;
        schoolId: string;
        actor?: import("@/lib/authz/types").AuthzActor;
      }
    | { error: string }
  > {
  const result = await requirePermission(permission, attrs);
  if ("error" in result) {
    return { error: result.error };
  }
  return {
    supabase: result.supabase,
    schoolId: result.schoolId,
    actor: result.actor,
  };
}
