/**
 * Communication Configuration Engine validation smoke tests (no DB).
 * Run: npx tsx scripts/smoke-communication-validation.ts
 */
import assert from "node:assert/strict";
import { COMM_CHANNELS } from "../lib/communications/types";
import {
  ensureCommCode,
  extractPlaceholders,
  filterRulesFromJson,
  filterRulesToJson,
  validateApprovalRuleInput,
  validateAudienceGroupInput,
  validateCategoryInput,
  validateDeliveryRuleInput,
  validatePriorityInput,
  validateTemplateInput,
  validateTemplateVersionInput,
} from "../lib/communications/validation";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("channels");
assert.ok(COMM_CHANNELS.includes("email"));
assert.ok(COMM_CHANNELS.includes("whatsapp"));
assert.ok(COMM_CHANNELS.includes("sms"));
assert.ok(COMM_CHANNELS.includes("notification"));
console.log("OK");

section("ensureCommCode");
assert.equal(ensureCommCode("Fee overdue", "FEE-OVER", "TPL"), "FEE-OVER");
console.log("OK");

section("validateCategoryInput / priority");
assert.ok(validateCategoryInput({ name: "" }).name);
assert.ok(validateCategoryInput({ name: "Fee", colour: "red" }).colour);
assert.equal(
  Object.keys(validateCategoryInput({ name: "Fee", colour: "#FF5500" })).length,
  0,
);
assert.ok(validatePriorityInput({ name: "High", rank: -1 }).rank);
console.log("OK");

section("validateAudienceGroupInput");
assert.ok(
  validateAudienceGroupInput({
    name: "Parents",
    filterRules: {},
  }).filterRules,
);
assert.equal(
  Object.keys(
    validateAudienceGroupInput({
      name: "Parents",
      filterRules: { includeParents: true },
    }),
  ).length,
  0,
);
console.log("OK");

section("filterRules JSON round-trip");
const json = filterRulesToJson({
  roles: ["parent"],
  includeParents: true,
  classIds: ["c1"],
});
assert.equal(json.include_parents, true);
assert.deepEqual(filterRulesFromJson(json).roles, ["parent"]);
console.log("OK");

section("validateTemplateInput / version");
assert.ok(
  validateTemplateInput({
    name: "X",
    channel: "fax" as "email",
  }).channel,
);
assert.ok(
  validateTemplateVersionInput(
    { templateId: "t1", body: "", subject: "" },
    "email",
  ).body,
);
assert.ok(
  validateTemplateVersionInput(
    { templateId: "t1", body: "Hello", subject: "" },
    "email",
  ).subject,
);
assert.equal(
  Object.keys(
    validateTemplateVersionInput(
      {
        templateId: "t1",
        body: "Hi {{ student.display_name }}",
        subject: "Notice",
      },
      "email",
    ),
  ).length,
  0,
);
console.log("OK");

section("extractPlaceholders");
assert.deepEqual(
  extractPlaceholders("Pay {{ invoice.amount }} by {{ invoice.due_date }}", "Fee"),
  ["invoice.amount", "invoice.due_date"],
);
console.log("OK");

section("delivery / approval rules");
assert.ok(validateDeliveryRuleInput({ name: "" }).name);
assert.ok(
  validateDeliveryRuleInput({
    name: "Overdue",
    channels: ["carrier_pigeon" as "email"],
  }).channels,
);
assert.ok(
  validateApprovalRuleInput({
    name: "High pri",
    requireApproval: true,
    approverRoles: [],
  }).approverRoles,
);
assert.equal(
  Object.keys(
    validateApprovalRuleInput({
      name: "High pri",
      approverRoles: ["school_admin"],
    }),
  ).length,
  0,
);
console.log("OK");

console.log("\nAll communication config validation checks passed.");
