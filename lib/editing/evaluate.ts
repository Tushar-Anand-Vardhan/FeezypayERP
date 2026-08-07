import type { createClient } from "@/lib/supabase/server";
import { getConfigEntityDefinition } from "@/lib/editing/registry";
import { computeChangedFields } from "@/lib/editing/diff";
import { recommendSoftMigrations } from "@/lib/editing/soft-migration";
import type {
  DependencyHit,
  EditEvaluation,
  EditStrategyCode,
} from "@/lib/editing/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function countDependencies(
  supabase: Supabase,
  entityType: string,
  entityId: string,
): Promise<DependencyHit[]> {
  const def = getConfigEntityDefinition(entityType);
  if (!def?.dependencies?.length) {
    return [];
  }

  const hits: DependencyHit[] = [];
  for (const dep of def.dependencies) {
    let query = supabase
      .from(dep.table)
      .select("id", { count: "exact", head: true })
      .eq(dep.column, entityId);

    if (dep.filters) {
      for (const [key, value] of Object.entries(dep.filters)) {
        if (value === null) {
          query = query.is(key, null);
        } else if (typeof value === "boolean") {
          query = query.eq(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
    }

    const { count, error } = await query;
    if (error) {
      // Table may not exist in older envs — skip quietly
      continue;
    }
    if ((count ?? 0) > 0) {
      hits.push({
        label: dep.label,
        table: dep.table,
        count: count ?? 0,
        blocks: dep.blocks,
      });
    }
  }
  return hits;
}

export async function evaluateConfigEdit(input: {
  supabase: Supabase;
  entityType: string;
  entityId: string;
  action: "update" | "archive" | "restore" | "hard_delete" | "duplicate";
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  currentStatus?: string | null;
}): Promise<EditEvaluation> {
  const def = getConfigEntityDefinition(input.entityType);
  const changedFields = computeChangedFields(input.before, input.after);
  const semanticChanges =
    def?.semanticFields?.filter((f) => changedFields.includes(f)) ?? [];
  const dependencyHits = await countDependencies(
    input.supabase,
    input.entityType,
    input.entityId,
  );

  const reasons: string[] = [];
  let allowed = true;
  let strategy: EditStrategyCode = "M";

  const immutable =
    Boolean(def?.immutableStatuses?.length) &&
    Boolean(
      input.currentStatus &&
        def?.immutableStatuses?.includes(input.currentStatus),
    );

  if (input.action === "hard_delete") {
    allowed = false;
    strategy = "K";
    reasons.push("Hard delete is denied for configuration; archive instead.");
  }

  if (input.action === "archive") {
    strategy = "K";
    const archiveBlockers = dependencyHits.filter((h) =>
      h.blocks.includes("archive"),
    );
    if (archiveBlockers.length > 0) {
      allowed = false;
      reasons.push(
        `Cannot archive while referenced by: ${archiveBlockers
          .map((h) => `${h.label} (${h.count})`)
          .join(", ")}.`,
      );
    }
  }

  if (input.action === "update") {
    if (immutable && semanticChanges.length > 0) {
      allowed = false;
      strategy = def?.versioned ? "V" : "X";
      reasons.push(
        `Status "${input.currentStatus}" is immutable for semantic fields: ${semanticChanges.join(", ")}.`,
      );
    } else if (immutable && changedFields.length > 0) {
      const onlyCosmetic = changedFields.every((f) =>
        (def?.cosmeticFields ?? []).includes(f),
      );
      if (!onlyCosmetic && def?.versioned) {
        allowed = false;
        strategy = "V";
        reasons.push(
          "Published/locked configuration requires a new version (or duplicate) instead of in-place rewrite.",
        );
      } else if (onlyCosmetic) {
        strategy = "R";
      }
    } else if (semanticChanges.length > 0) {
      const semanticBlockers = dependencyHits.filter((h) =>
        h.blocks.includes("semantic_edit"),
      );
      if (semanticBlockers.length > 0) {
        allowed = false;
        strategy = def?.versioned ? "V" : "K";
        reasons.push(
          `Semantic change blocked by operational refs: ${semanticBlockers
            .map((h) => h.label)
            .join(", ")}.`,
        );
      } else {
        strategy = "M";
      }
    } else {
      strategy = changedFields.some((f) =>
        (def?.cosmeticFields ?? []).includes(f),
      )
        ? "R"
        : "M";
    }
  }

  if (input.action === "duplicate") {
    strategy = def?.versioned ? "V" : "M";
    allowed = true;
  }

  if (input.action === "restore") {
    strategy = "K";
    allowed = true;
  }

  const softMigrations = recommendSoftMigrations({
    entityType: input.entityType,
    action: allowed
      ? input.action
      : input.action === "hard_delete"
        ? "hard_delete"
        : "semantic_edit_blocked",
    semanticChanges,
    dependencyLabels: dependencyHits.map((h) => h.label),
    versioned: def?.versioned,
    immutable,
  });

  if (!allowed && reasons.length === 0) {
    reasons.push("Edit denied by configuration editing framework.");
  }

  return {
    allowed,
    strategy,
    reasons,
    dependencyHits,
    softMigrations,
    changedFields,
    semanticChanges,
  };
}
