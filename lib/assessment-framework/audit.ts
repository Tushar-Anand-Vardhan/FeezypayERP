import type { createClient } from "@/lib/supabase/server";
import { recordConfigMutation } from "@/lib/editing/record";
import type { ConfigMutationAction } from "@/lib/editing/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function writeFrameworkAudit(
  supabase: Supabase,
  input: {
    schoolId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    actorAuthUserId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase
    .from("assessment_framework_audit_log")
    .insert({
      school_id: input.schoolId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      actor_auth_user_id: input.actorAuthUserId ?? null,
      old_values: input.oldValues ?? null,
      new_values: input.newValues ?? null,
      metadata: input.metadata ?? {},
    });
  if (error) {
    console.error("assessment_framework_audit_log insert failed:", error.message);
  }
}

export async function recordFrameworkMutation(
  supabase: Supabase,
  input: {
    schoolId: string;
    authUserId?: string | null;
    entityType?: string;
    entityId: string;
    action: ConfigMutationAction;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    versionLabel?: string;
    localAction?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await writeFrameworkAudit(supabase, {
    schoolId: input.schoolId,
    action: input.localAction ?? input.action,
    entityType: input.entityType ?? "assessment_framework",
    entityId: input.entityId,
    actorAuthUserId: input.authUserId,
    oldValues: input.before,
    newValues: input.after,
    metadata: input.metadata,
  });

  await recordConfigMutation(supabase, {
    schoolId: input.schoolId,
    authUserId: input.authUserId,
    entityType: input.entityType ?? "assessment_framework",
    entityId: input.entityId,
    action: input.action,
    before: input.before,
    after: input.after,
    versionLabel: input.versionLabel,
    metadata: input.metadata,
  });
}
