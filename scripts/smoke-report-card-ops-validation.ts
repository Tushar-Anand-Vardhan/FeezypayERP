/**
 * Pure validation smoke for Report Card Engine (E20 issue).
 * Run: npx tsx scripts/smoke-report-card-ops-validation.ts
 */

import {
  REPORT_CARD_ISSUE_STATUSES,
  REPORT_CARD_VERSION_STATUSES,
} from "../lib/report-cards/ops-types";
import {
  mayEditRemarks,
  mayRegenerateVersion,
  validateCreateDraftInput,
  validateIssueInput,
  validateUpdateRemarksInput,
} from "../lib/report-cards/ops-validation";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("=== statuses ===");
assert(
  REPORT_CARD_ISSUE_STATUSES.includes("draft") &&
    REPORT_CARD_ISSUE_STATUSES.includes("published") &&
    REPORT_CARD_ISSUE_STATUSES.includes("locked"),
  "issue statuses",
);
assert(
  REPORT_CARD_VERSION_STATUSES.includes("draft") &&
    REPORT_CARD_VERSION_STATUSES.includes("superseded"),
  "version statuses",
);
console.log("OK");

console.log("=== edit / regenerate gates ===");
assert(mayRegenerateVersion("draft"), "regen draft");
assert(!mayRegenerateVersion("issued"), "no regen issued");
assert(mayEditRemarks("draft", "draft"), "edit remarks draft");
assert(!mayEditRemarks("issued", "issued"), "no edit issued");
assert(!mayEditRemarks("draft", "revoked"), "no edit revoked");
console.log("OK");

console.log("=== create draft validation ===");
{
  const bad = validateCreateDraftInput({
    studentProfileId: "",
    academicYearId: "",
    templateId: "",
  });
  assert(bad.studentProfileId && bad.academicYearId && bad.templateId, "req");
  const good = validateCreateDraftInput({
    studentProfileId: "s1",
    academicYearId: "y1",
    templateId: "t1",
    teacherRemarks: "Good progress",
    principalRemarks: "Promoted",
  });
  assert(Object.keys(good).length === 0, "good draft");
}
console.log("OK");

console.log("=== remarks + issue validation ===");
{
  const badR = validateUpdateRemarksInput({ issueId: "" });
  assert(badR.issueId, "remarks need issue");
  const badI = validateIssueInput({ issueId: "" });
  assert(badI.issueId, "issue needs id");
  assert(
    Object.keys(validateIssueInput({ issueId: "i1" })).length === 0,
    "good issue",
  );
}
console.log("OK");

console.log("=== no-duplication contract (types) ===");
{
  // source_refs hold ids only; presentation holds derived display
  const sourceRefs = {
    examResultIds: ["er1"],
    examDefinitionIds: ["ed1"],
    gradeCalculationRunIds: [],
    gradeCalculationResultIds: [],
    conductIncidentIds: [],
    achievementIds: [],
    observationRecordIds: [],
    curriculumProgressIds: [],
    houseMembershipIds: [],
    clubMembershipIds: [],
    studentAcademicYearId: null,
    templateId: "t1",
    templateVersionId: "tv1",
    academicYearId: "y1",
    termId: null,
  };
  assert(Array.isArray(sourceRefs.examResultIds), "pointers not rows");
  assert(!("marks_obtained" in sourceRefs), "no marks on refs");
}
console.log("OK");

console.log("\nAll report card ops smoke checks passed.");
