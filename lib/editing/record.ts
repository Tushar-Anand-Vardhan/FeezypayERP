import type { createClient } from "@/lib/supabase/server";
import { pickChangedValues } from "@/lib/editing/diff";
import type {
  AuditWriteInput,
  ConfigMutationAction,
  HistoryWriteInput,
  SoftMigrationRecommendation,
} from "@/lib/editing/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function writeAuditEntry(
  supabase: Supabase,
  input: AuditWriteInput,
): Promise<string | null> {
  const changed =
    input.changedFields ??
    Object.keys({
      ...(input.oldValues ?? {}),
      ...(input.newValues ?? {}),
    });

  const { data, error } = await supabase
    .from("audit_entries")
    .insert({
      school_id: input.schoolId,
      actor_type: "user",
      auth_user_id: input.authUserId ?? null,
      persona: input.persona ?? "school_admin",
      action: input.action,
      entity_type: input.entityType,
      entity_id: String(input.entityId),
      severity: input.severity ?? "info",
      outcome: input.outcome ?? "succeeded",
      correlation_id: input.correlationId ?? null,
      old_values: input.oldValues ?? null,
      new_values: input.newValues ?? null,
      changed_fields: changed,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("audit_entries insert failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function writeConfigHistory(
  supabase: Supabase,
  input: HistoryWriteInput,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("config_change_history")
    .insert({
      school_id: input.schoolId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      version_label: input.versionLabel ?? null,
      snapshot: input.snapshot ?? {},
      diff: input.diff ?? {},
      soft_migration: input.softMigration ?? null,
      audit_entry_id: input.auditEntryId ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("config_change_history insert failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

/**
 * Record audit + history after a successful config mutation.
 * Failures are logged but do not roll back the domain write (best-effort).
 */
export async function recordConfigMutation(
  supabase: Supabase,
  input: {
    schoolId: string;
    authUserId?: string | null;
    entityType: string;
    entityId: string;
    action: ConfigMutationAction;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    versionLabel?: string;
    softMigration?: SoftMigrationRecommendation | SoftMigrationRecommendation[] | null;
    metadata?: Record<string, unknown>;
    severity?: AuditWriteInput["severity"];
  },
): Promise<{ auditId: string | null; historyId: string | null }> {
  const { oldValues, newValues } = pickChangedValues(input.before, input.after);
  const changedFields = Object.keys({ ...oldValues, ...newValues });

  const auditId = await writeAuditEntry(supabase, {
    schoolId: input.schoolId,
    authUserId: input.authUserId,
    action: `config.${input.action}`,
    entityType: input.entityType,
    entityId: input.entityId,
    oldValues: Object.keys(oldValues).length ? oldValues : null,
    newValues: Object.keys(newValues).length ? newValues : null,
    changedFields,
    metadata: input.metadata,
    severity: input.severity ?? (input.action === "archive" ? "notice" : "info"),
  });

  const historyId = await writeConfigHistory(supabase, {
    schoolId: input.schoolId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    versionLabel: input.versionLabel,
    snapshot: input.after ?? input.before ?? {},
    diff: { old: oldValues, new: newValues },
    softMigration: input.softMigration,
    auditEntryId: auditId,
    createdBy: input.authUserId,
  });

  return { auditId, historyId };
}
