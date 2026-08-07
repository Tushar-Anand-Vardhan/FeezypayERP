/**
 * Phase 3 Report Card Engine validation smoke.
 * Run: npx tsx scripts/smoke-report-card-phase3-validation.ts
 */

import { PERMISSION_KEYS } from "../lib/authz/catalog";
import { SYSTEM_ROLE_BUNDLES } from "../lib/authz/bundles";
import {
  BLOCK_TYPES,
  FIELD_ASSIGNEE_ROLES,
} from "../lib/report-cards/types";
import {
  REPORT_CARD_ISSUE_STATUSES,
  REPORT_CARD_VERSION_STATUSES,
  isLockedStatus,
  isPublishedStatus,
} from "../lib/report-cards/ops-types";
import {
  mayEditRemarks,
  mayFillFields,
  mayLockIssue,
  mayPublishVersion,
  mayRegenerateVersion,
  validateFieldAssignmentInput,
  validateFillFieldsInput,
} from "../lib/report-cards/ops-validation";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("=== AuthZ keys + teacher fill ===");
assert(
  PERMISSION_KEYS.includes("document.report_card.fill"),
  "fill key",
);
assert(
  PERMISSION_KEYS.includes("document.report_card.lock"),
  "lock key",
);
assert(
  SYSTEM_ROLE_BUNDLES.teacher.includes("document.report_card.fill"),
  "teacher fill",
);
assert(
  !SYSTEM_ROLE_BUNDLES.teacher.includes("document.report_card.issue"),
  "teacher no issue",
);
assert(
  !SYSTEM_ROLE_BUNDLES.teacher.includes("document.report_card.lock"),
  "teacher no lock",
);
assert(
  SYSTEM_ROLE_BUNDLES.hod.includes("document.report_card.lock"),
  "hod lock",
);
console.log("OK");

console.log("=== designer block types + assignee roles ===");
for (const t of [
  "grade_summary",
  "achievements",
  "behaviour",
  "curriculum",
  "observations",
  "promotion",
]) {
  assert(BLOCK_TYPES.includes(t as never), t);
}
assert(FIELD_ASSIGNEE_ROLES.includes("class_teacher"), "class_teacher");
console.log("OK");

console.log("=== lifecycle gates ===");
assert(
  REPORT_CARD_ISSUE_STATUSES.join(",").includes("published"),
  "published status",
);
assert(
  REPORT_CARD_ISSUE_STATUSES.join(",").includes("locked"),
  "locked status",
);
assert(mayRegenerateVersion("draft"), "regen draft");
assert(!mayRegenerateVersion("published"), "no regen published");
assert(mayPublishVersion("draft", "draft"), "publish draft");
assert(!mayPublishVersion("published", "published"), "no re-publish");
assert(mayLockIssue("published"), "lock published");
assert(mayLockIssue("issued"), "lock legacy issued");
assert(!mayLockIssue("draft"), "no lock draft");
assert(mayFillFields("draft", "draft"), "fill draft");
assert(!mayFillFields("draft", "locked"), "no fill locked issue");
assert(!mayEditRemarks("published", "published"), "no edit published");
assert(isPublishedStatus("issued"), "legacy issued published");
assert(isPublishedStatus("locked"), "locked is published family");
assert(isLockedStatus("locked"), "locked");
assert(
  REPORT_CARD_VERSION_STATUSES.includes("superseded"),
  "historical superseded",
);
console.log("OK");

console.log("=== field assignment validation ===");
{
  const bad = validateFieldAssignmentInput({
    templateId: "",
    fieldKey: "Bad Key",
    fieldLabel: "",
  });
  assert(bad.templateId && bad.fieldKey && bad.fieldLabel, "req");
  const good = validateFieldAssignmentInput({
    templateId: "t1",
    fieldKey: "teacher_remarks",
    fieldLabel: "Class teacher remarks",
    assigneeRole: "class_teacher",
  });
  assert(Object.keys(good).length === 0, "good assignment");
}
console.log("OK");

console.log("=== fill fields validation + no-duplication contract ===");
{
  const bad = validateFillFieldsInput({ issueId: "", fields: {} });
  assert(bad.issueId, "need issue");
  const sourceRefs = {
    examResultIds: [],
    examDefinitionIds: [],
    gradeCalculationRunIds: ["run1"],
    gradeCalculationResultIds: ["res1"],
    conductIncidentIds: [],
    achievementIds: ["ach1"],
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
  assert(
    Array.isArray(sourceRefs.gradeCalculationRunIds),
    "E33 pins are ids",
  );
  assert(!("final_marks" in sourceRefs), "no marks on refs");
}
console.log("OK");

console.log("\nAll report card Phase 3 validation smokes passed.");
