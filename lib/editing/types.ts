/** Configuration Editing Framework — shared mutation contract for all config engines. */

export type EditStrategyCode =
  | "M" // mutable in place (cosmetic / draft)
  | "R" // soft rename
  | "V" // versioned
  | "E" // effective-dated
  | "X" // immutable after publish/lock
  | "K"; // archive-only retirement

export type ConfigMutationAction =
  | "create"
  | "update"
  | "archive"
  | "restore"
  | "duplicate"
  | "publish_version"
  | "retire"
  | "evaluate";

export type SoftMigrationKind =
  | "rename_only"
  | "archive_and_create"
  | "clone_new_version"
  | "effective_date_cutover"
  | "year_scoped_clone"
  | "blocked_use_correction_workflow";

export type SoftMigrationRecommendation = {
  kind: SoftMigrationKind;
  title: string;
  rationale: string;
  steps: string[];
  blocksDestructiveEdit: boolean;
};

export type DependencyRef = {
  /** Logical name for UI */
  label: string;
  table: string;
  column: string;
  /** Extra filters e.g. { archived_at: null } — only equality supported */
  filters?: Record<string, string | null | boolean>;
  /** If count > 0, which mutations are blocked */
  blocks: Array<"archive" | "hard_delete" | "semantic_edit" | "restore_conflict">;
};

export type ConfigEntityDefinition = {
  entityType: string;
  table: string;
  schoolScoped: boolean;
  /** Strategies allowed for this entity */
  strategies: EditStrategyCode[];
  /** Fields that change meaning if edited while referenced (not cosmetic rename) */
  semanticFields?: string[];
  /** Cosmetic fields safe for identity-preserving rename */
  cosmeticFields?: string[];
  dependencies?: DependencyRef[];
  /** Prefer version publish over in-place edit when published */
  versioned?: boolean;
  statusField?: string;
  immutableStatuses?: string[];
};

export type DependencyHit = {
  label: string;
  table: string;
  count: number;
  blocks: DependencyRef["blocks"];
};

export type EditEvaluation = {
  allowed: boolean;
  strategy: EditStrategyCode;
  reasons: string[];
  dependencyHits: DependencyHit[];
  softMigrations: SoftMigrationRecommendation[];
  changedFields: string[];
  semanticChanges: string[];
};

export type AuditWriteInput = {
  schoolId: string;
  authUserId?: string | null;
  persona?: string;
  action: string;
  entityType: string;
  entityId: string;
  severity?: "debug" | "info" | "notice" | "warning" | "critical";
  outcome?: "succeeded" | "failed" | "denied";
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changedFields?: string[];
  metadata?: Record<string, unknown>;
  correlationId?: string;
};

export type HistoryWriteInput = {
  schoolId: string;
  entityType: string;
  entityId: string;
  action: ConfigMutationAction;
  versionLabel?: string;
  snapshot?: Record<string, unknown>;
  diff?: Record<string, unknown>;
  softMigration?: SoftMigrationRecommendation | SoftMigrationRecommendation[] | null;
  auditEntryId?: string | null;
  createdBy?: string | null;
};

export type EditingActionResult =
  | { success: true; message: string; id?: string; evaluation?: EditEvaluation }
  | {
      success: false;
      error: string;
      evaluation?: EditEvaluation;
      fieldErrors?: Record<string, string>;
    };
