import type { SoftMigrationRecommendation } from "@/lib/editing/types";

export function computeChangedFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): string[] {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const changed: string[] = [];
  for (const key of keys) {
    const a = before?.[key];
    const b = after?.[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changed.push(key);
    }
  }
  return changed;
}

export function pickChangedValues(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  fields?: string[],
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const changed = fields ?? computeChangedFields(before, after);
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  for (const field of changed) {
    if (before && field in before) {
      oldValues[field] = before[field];
    }
    if (after && field in after) {
      newValues[field] = after[field];
    }
  }
  return { oldValues, newValues };
}

export function recommendSoftMigrations(input: {
  entityType: string;
  action: string;
  semanticChanges: string[];
  dependencyLabels: string[];
  versioned?: boolean;
  immutable?: boolean;
}): SoftMigrationRecommendation[] {
  const recs: SoftMigrationRecommendation[] = [];
  const deps = input.dependencyLabels;

  if (input.immutable || input.action === "semantic_edit_blocked") {
    if (input.versioned) {
      recs.push({
        kind: "clone_new_version",
        title: "Clone / publish a new version",
        rationale:
          "This configuration is locked or published. In-place edits would rewrite the meaning of historical operational records.",
        steps: [
          "Keep the current published version immutable for past ops",
          "Open a new draft version (or duplicate the entity)",
          "Apply changes on the draft",
          "Publish the new version for future use only",
        ],
        blocksDestructiveEdit: true,
      });
    } else {
      recs.push({
        kind: "archive_and_create",
        title: "Archive and create a replacement",
        rationale:
          "Semantic edits are blocked while operational references exist.",
        steps: [
          "Archive the current configuration row",
          "Create a new row with the corrected meaning",
          "Point future work (offers, templates, schedules) at the new id",
          "Leave historical FKs pointing at the archived id",
        ],
        blocksDestructiveEdit: true,
      });
    }
  }

  if (input.semanticChanges.length > 0 && deps.length > 0) {
    recs.push({
      kind: "rename_only",
      title: "Rename only (identity-preserving)",
      rationale: `References exist (${deps.join(", ")}). Cosmetic rename is safe; changing ${input.semanticChanges.join(", ")} is not.`,
      steps: [
        "Change display name / description only",
        "Do not change semantic fields while references remain",
        "If meaning must change, use archive+create or a new version",
      ],
      blocksDestructiveEdit: true,
    });
  }

  if (input.entityType === "academic_year" || input.entityType === "class") {
    recs.push({
      kind: "year_scoped_clone",
      title: "Clone for the next academic year",
      rationale:
        "Year-scoped structure should be cloned into a new year pack rather than rewritten in place.",
      steps: [
        "Lock or close the current year when ops are complete",
        "Clone structure into the new academic year",
        "Apply structural changes only on the open year",
      ],
      blocksDestructiveEdit: true,
    });
  }

  if (input.action === "hard_delete") {
    recs.push({
      kind: "blocked_use_correction_workflow",
      title: "Archive instead of hard delete",
      rationale:
        "Hard delete of configuration is denied when history or operational FKs may exist.",
      steps: [
        "Archive the row to hide it from pickers",
        "Retain id for historical joins",
        "Use Super Admin purge only for never-referenced drafts (rare, audited)",
      ],
      blocksDestructiveEdit: true,
    });
  }

  if (
    input.entityType === "grading_scale" ||
    input.entityType === "message_template" ||
    input.entityType === "report_card_template" ||
    input.entityType === "school_policy"
  ) {
    if (!recs.some((r) => r.kind === "clone_new_version")) {
      recs.push({
        kind: "clone_new_version",
        title: "Prefer version publish over rewrite",
        rationale:
          "Versioned catalogs must not mutate published payloads in place.",
        steps: [
          "Edit draft version content",
          "Publish to create an immutable version",
          "Pin version ids on operational / issued records",
        ],
        blocksDestructiveEdit: false,
      });
    }
  }

  return recs;
}
