"use server";

import { evaluateConfigEdit } from "@/lib/editing/evaluate";
import {
  listRegisteredConfigEntities,
  getConfigEntityDefinition,
} from "@/lib/editing/registry";
import type {
  EditEvaluation,
  EditingActionResult,
} from "@/lib/editing/types";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function listConfigEntityTypesAction(): Promise<
  | { success: true; entityTypes: string[] }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }
  return { success: true, entityTypes: listRegisteredConfigEntities() };
}

export async function evaluateConfigEditAction(input: {
  entityType: string;
  entityId: string;
  action: "update" | "archive" | "restore" | "hard_delete" | "duplicate";
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  currentStatus?: string | null;
}): Promise<
  | { success: true; evaluation: EditEvaluation }
  | { success: false; error: string; evaluation?: EditEvaluation }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  if (!getConfigEntityDefinition(input.entityType)) {
    return { success: false, error: `Unknown config entity type: ${input.entityType}` };
  }

  const evaluation = await evaluateConfigEdit({
    supabase: context.supabase,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    before: input.before,
    after: input.after,
    currentStatus: input.currentStatus,
  });

  return { success: true, evaluation };
}

export async function listConfigChangeHistoryAction(input: {
  entityType: string;
  entityId: string;
  limit?: number;
}): Promise<
  | {
      success: true;
      history: Array<{
        id: string;
        action: string;
        version_label: string | null;
        snapshot: unknown;
        diff: unknown;
        soft_migration: unknown;
        created_by: string | null;
        created_at: string;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data, error } = await supabase
    .from("config_change_history")
    .select(
      "id, action, version_label, snapshot, diff, soft_migration, created_by, created_at",
    )
    .eq("school_id", schoolId)
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, history: data ?? [] };
}

export async function listConfigAuditEntriesAction(input: {
  entityType?: string;
  entityId?: string;
  limit?: number;
}): Promise<
  | {
      success: true;
      entries: Array<{
        id: string;
        occurred_at: string;
        action: string;
        entity_type: string;
        entity_id: string;
        severity: string;
        outcome: string;
        old_values: unknown;
        new_values: unknown;
        changed_fields: string[];
        auth_user_id: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("audit_entries")
    .select(
      "id, occurred_at, action, entity_type, entity_id, severity, outcome, old_values, new_values, changed_fields, auth_user_id",
    )
    .eq("school_id", schoolId)
    .order("occurred_at", { ascending: false })
    .limit(input.limit ?? 50);

  if (input.entityType) {
    query = query.eq("entity_type", input.entityType);
  }
  if (input.entityId) {
    query = query.eq("entity_id", input.entityId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, entries: data ?? [] };
}

/**
 * Generic duplicate helper for school-scoped catalog rows with code/name.
 * Callers should pass table + columns; framework records history/audit.
 */
export async function duplicateConfigRowAction(input: {
  entityType: string;
  sourceId: string;
  nameSuffix?: string;
}): Promise<EditingActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const def = getConfigEntityDefinition(input.entityType);
  if (!def || !def.schoolScoped) {
    return {
      success: false,
      error: "Duplicate is only supported for registered school-scoped catalogs via this helper.",
    };
  }

  const { supabase, schoolId } = context;
  const evaluation = await evaluateConfigEdit({
    supabase,
    entityType: input.entityType,
    entityId: input.sourceId,
    action: "duplicate",
  });
  if (!evaluation.allowed) {
    return {
      success: false,
      error: evaluation.reasons.join(" ") || "Duplicate not allowed.",
      evaluation,
    };
  }

  const { data: source, error: sourceError } = await supabase
    .from(def.table)
    .select("*")
    .eq("id", input.sourceId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (sourceError || !source) {
    return { success: false, error: sourceError?.message ?? "Source not found." };
  }

  const suffix = input.nameSuffix?.trim() || " (copy)";
  const clone: Record<string, unknown> = { ...source };
  delete clone.id;
  delete clone.created_at;
  delete clone.updated_at;
  delete clone.archived_at;
  clone.school_id = schoolId;
  if (typeof clone.name === "string") {
    clone.name = `${clone.name}${suffix}`;
  }
  if (typeof clone.code === "string") {
    clone.code = `${String(clone.code).slice(0, 24)}-COPY`;
  }
  if ("status" in clone && typeof clone.status === "string") {
    clone.status = "draft";
  }
  if ("publishing_status" in clone) {
    clone.publishing_status = "draft";
  }

  const actorId = await getActorId(supabase);
  if ("created_by" in clone) {
    clone.created_by = actorId;
  }
  if ("updated_by" in clone) {
    clone.updated_by = actorId;
  }

  const { data: created, error } = await supabase
    .from(def.table)
    .insert(clone)
    .select("id")
    .maybeSingle();

  if (error || !created) {
    return {
      success: false,
      error: error?.message ?? "Could not duplicate.",
      evaluation,
    };
  }

  const { recordConfigMutation } = await import("@/lib/editing/record");
  await recordConfigMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityType: input.entityType,
    entityId: created.id,
    action: "duplicate",
    before: null,
    after: { ...clone, id: created.id, duplicated_from: input.sourceId },
    softMigration: evaluation.softMigrations,
    metadata: { source_id: input.sourceId },
  });

  return {
    success: true,
    message: "Configuration duplicated.",
    id: created.id,
    evaluation,
  };
}
