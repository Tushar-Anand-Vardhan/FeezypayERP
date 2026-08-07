/** Public barrel for Configuration Editing Framework. */
export {
  evaluateConfigEditAction,
  listConfigAuditEntriesAction,
  listConfigChangeHistoryAction,
  listConfigEntityTypesAction,
  duplicateConfigRowAction,
} from "@/lib/editing/actions";
export { evaluateConfigEdit, countDependencies } from "@/lib/editing/evaluate";
export { recordConfigMutation, writeAuditEntry } from "@/lib/editing/record";
export {
  CONFIG_ENTITY_REGISTRY,
  getConfigEntityDefinition,
  listRegisteredConfigEntities,
} from "@/lib/editing/registry";
export { recommendSoftMigrations } from "@/lib/editing/soft-migration";
export { computeChangedFields, pickChangedValues } from "@/lib/editing/diff";
export type * from "@/lib/editing/types";
