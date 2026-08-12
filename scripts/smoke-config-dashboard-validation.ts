/**
 * Configuration Dashboard smoke tests (no DB).
 * Run: npx tsx scripts/smoke-config-dashboard-validation.ts
 */
import assert from "node:assert/strict";
import { CONFIG_DASHBOARD_MODULES } from "../lib/config-dashboard/catalog";
import {
  onboardingStepsCoveredByHub,
  resolveConfigHubTab,
} from "../lib/config-dashboard/hub-tabs";
import {
  completionLabel,
  healthLabel,
} from "../lib/config-dashboard/labels";
import type { ConfigModuleId } from "../lib/config-dashboard/types";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("catalog coverage");
const ids = CONFIG_DASHBOARD_MODULES.map((m) => m.id);
const required: ConfigModuleId[] = [
  "school_branding",
  "academic_calendar",
  "structure",
  "subjects",
  "grading_scales",
  "houses_clubs",
  "departments",
  "timetable",
  "assessment",
  "report_cards",
  "policies",
  "communications",
  "editing_framework",
];
for (const id of required) {
  assert.ok(ids.includes(id), `missing module ${id}`);
}
assert.equal(new Set(ids).size, ids.length, "duplicate module ids");
for (const mod of CONFIG_DASHBOARD_MODULES) {
  assert.ok(mod.href.length > 0, `${mod.id} needs href`);
  assert.ok(mod.name.length > 0);
  assert.ok(mod.engine.length > 0);
}
console.log("OK", ids.length, "modules");

section("labels");
assert.equal(completionLabel("complete"), "Complete");
assert.equal(completionLabel("backend_only"), "Configured (API)");
assert.equal(healthLabel("critical"), "Critical");
console.log("OK");

section("config hub tabs");
assert.equal(resolveConfigHubTab(undefined), "health");
assert.equal(resolveConfigHubTab("school-identity"), "school-identity");
assert.equal(resolveConfigHubTab("classes"), "structure");
assert.equal(resolveConfigHubTab("sections"), "structure");
assert.equal(resolveConfigHubTab("nope"), "health");
assert.ok(onboardingStepsCoveredByHub(), "hub covers onboarding steps");
for (const mod of CONFIG_DASHBOARD_MODULES) {
  assert.ok(
    !mod.href.startsWith("/onboarding/"),
    `${mod.id} should not deep-link completed schools into onboarding (${mod.href})`,
  );
}
console.log("OK");

console.log("\nAll config dashboard smoke checks passed.");
