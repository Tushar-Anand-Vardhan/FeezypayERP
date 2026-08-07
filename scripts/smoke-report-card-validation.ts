/**
 * Report Card Template Engine validation smoke tests (no DB).
 * Run: npx tsx scripts/smoke-report-card-validation.ts
 */
import assert from "node:assert/strict";
import {
  ensureBoardCode,
  ensureTemplateCode,
  isTemplateMutable,
  layoutConfigFromJson,
  layoutConfigToJson,
  normalizeLayoutConfig,
  validateAssessmentBindingInput,
  validateBlockInput,
  validateBoardInput,
  validateScopeInput,
  validateSignatureSlotInput,
  validateTemplateInput,
} from "../lib/report-cards/validation";
import { DEFAULT_BLOCK_BLUEPRINT } from "../lib/report-cards/types";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("ensureBoardCode / ensureTemplateCode");
assert.equal(ensureBoardCode("Central Board", "cbse"), "CBSE");
assert.equal(ensureTemplateCode("Term 1 Card", ""), "TERM-1-CARD");
console.log("OK");

section("validateBoardInput");
assert.ok(validateBoardInput({ name: "" }).name);
assert.equal(Object.keys(validateBoardInput({ name: "CBSE" })).length, 0);
console.log("OK");

section("validateTemplateInput");
assert.ok(validateTemplateInput({ name: "" }).name);
assert.ok(
  validateTemplateInput({
    name: "Card",
    status: "nope" as "draft",
  }).status,
);
assert.equal(
  Object.keys(
    validateTemplateInput({
      name: "Term 1",
      layoutConfig: { pageSize: "A4", orientation: "portrait" },
      includeGrades: true,
      includeAttendance: true,
    }),
  ).length,
  0,
);
console.log("OK");

section("validateScopeInput");
assert.ok(
  validateScopeInput({ templateId: "t1", classId: null, sectionId: null }).scope,
);
assert.equal(
  Object.keys(
    validateScopeInput({ templateId: "t1", classId: "c1", sectionId: null }),
  ).length,
  0,
);
console.log("OK");

section("validateAssessmentBindingInput");
assert.ok(
  validateAssessmentBindingInput({
    templateId: "t1",
    examDefinitionId: "",
  }).examDefinitionId,
);
assert.equal(
  Object.keys(
    validateAssessmentBindingInput({
      templateId: "t1",
      examDefinitionId: "exam-1",
      showGrades: true,
    }),
  ).length,
  0,
);
console.log("OK");

section("validateBlockInput");
assert.ok(
  validateBlockInput({
    templateId: "t1",
    blockType: "not-real" as "grades",
  }).blockType,
);
assert.equal(
  Object.keys(
    validateBlockInput({
      templateId: "t1",
      blockType: "teacher_comments",
      title: "Teacher comments",
    }),
  ).length,
  0,
);
console.log("OK");

section("validateSignatureSlotInput");
assert.ok(
  validateSignatureSlotInput({
    templateId: "t1",
    roleLabel: "",
  }).roleLabel,
);
assert.equal(
  Object.keys(
    validateSignatureSlotInput({
      templateId: "t1",
      roleLabel: "Principal",
      signatureType: "digital_stub",
      requiresDigital: true,
    }),
  ).length,
  0,
);
console.log("OK");

section("layoutConfig round-trip");
const layout = normalizeLayoutConfig({
  pageSize: "Letter",
  orientation: "landscape",
  marginsMm: { top: 10 },
});
const json = layoutConfigToJson(layout);
assert.equal(json.page_size, "Letter");
assert.equal(layoutConfigFromJson(json).orientation, "landscape");
console.log("OK");

section("mutability + default blueprint");
assert.equal(isTemplateMutable("draft"), true);
assert.equal(isTemplateMutable("published"), false);
assert.equal(isTemplateMutable("retired"), false);
assert.ok(DEFAULT_BLOCK_BLUEPRINT.some((b) => b.blockType === "grades"));
assert.ok(DEFAULT_BLOCK_BLUEPRINT.some((b) => b.blockType === "attendance"));
assert.ok(
  DEFAULT_BLOCK_BLUEPRINT.some((b) => b.blockType === "principal_comments"),
);
console.log("OK");

console.log("\nAll report card template validation checks passed.");
