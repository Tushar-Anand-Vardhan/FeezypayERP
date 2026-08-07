/**
 * Configuration Editing Framework smoke tests (no DB).
 * Run: npx tsx scripts/smoke-editing-validation.ts
 */
import assert from "node:assert/strict";
import { computeChangedFields, pickChangedValues } from "../lib/editing/diff";
import {
  CONFIG_ENTITY_REGISTRY,
  getConfigEntityDefinition,
  listRegisteredConfigEntities,
} from "../lib/editing/registry";
import { recommendSoftMigrations } from "../lib/editing/soft-migration";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("registry coverage");
const types = listRegisteredConfigEntities();
assert.ok(types.includes("subject"));
assert.ok(types.includes("grading_scale"));
assert.ok(types.includes("exam_definition"));
assert.ok(types.includes("message_template"));
assert.ok(types.includes("school_policy"));
assert.ok(types.includes("report_card_template"));
assert.ok(getConfigEntityDefinition("subject")?.dependencies?.length);
assert.equal(CONFIG_ENTITY_REGISTRY.grading_scale.versioned, true);
console.log("OK", types.length, "entity types");

section("diff helpers");
const changed = computeChangedFields(
  { name: "A", type: "core" },
  { name: "B", type: "core" },
);
assert.deepEqual(changed, ["name"]);
const picked = pickChangedValues(
  { name: "A", type: "core" },
  { name: "B", type: "core" },
);
assert.equal(picked.oldValues.name, "A");
assert.equal(picked.newValues.name, "B");
console.log("OK");

section("soft migration recommendations");
const blocked = recommendSoftMigrations({
  entityType: "subject",
  action: "semantic_edit_blocked",
  semanticChanges: ["type"],
  dependencyLabels: ["Timetable slots"],
  versioned: false,
  immutable: false,
});
assert.ok(blocked.some((r) => r.kind === "rename_only"));
assert.ok(blocked.some((r) => r.kind === "archive_and_create"));
assert.ok(blocked.every((r) => Array.isArray(r.steps) && r.steps.length > 0));

const versioned = recommendSoftMigrations({
  entityType: "grading_scale",
  action: "semantic_edit_blocked",
  semanticChanges: ["bands"],
  dependencyLabels: [],
  versioned: true,
  immutable: true,
});
assert.ok(versioned.some((r) => r.kind === "clone_new_version"));
assert.ok(versioned[0].blocksDestructiveEdit);

const hardDelete = recommendSoftMigrations({
  entityType: "house",
  action: "hard_delete",
  semanticChanges: [],
  dependencyLabels: [],
});
assert.ok(hardDelete.some((r) => r.kind === "blocked_use_correction_workflow"));
console.log("OK");

section("immutable / versioned flags");
assert.deepEqual(
  getConfigEntityDefinition("exam_definition")?.immutableStatuses,
  ["published", "locked"],
);
assert.equal(getConfigEntityDefinition("message_template")?.versioned, true);
console.log("OK");

console.log("\nAll editing framework validation checks passed.");
