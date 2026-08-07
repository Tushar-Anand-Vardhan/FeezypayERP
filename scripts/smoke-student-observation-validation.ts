/**
 * Student Observation Engine (E34) validation smoke.
 * Run: npx tsx scripts/smoke-student-observation-validation.ts
 */

import { PERMISSION_KEYS } from "../lib/authz/catalog";
import { SYSTEM_ROLE_BUNDLES } from "../lib/authz/bundles";
import {
  OBSERVATION_VISIBILITIES,
  SYSTEM_OBSERVATION_CATEGORIES,
} from "../lib/observations/types";
import {
  mayUpdateRemarkBody,
  validateListFilter,
  validateQueueAiSummaryInput,
  validateRecordObservationInput,
  validateSupersedeObservationInput,
  validateUpsertCategoryInput,
  visibilityFlags,
} from "../lib/observations/validation";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("=== AuthZ keys + teacher record ===");
assert(
  PERMISSION_KEYS.includes("student_observation.record"),
  "record key",
);
assert(
  SYSTEM_ROLE_BUNDLES.teacher.includes("student_observation.record"),
  "teacher record",
);
assert(
  !SYSTEM_ROLE_BUNDLES.teacher.includes("student_observation.configure"),
  "teacher no configure",
);
assert(
  SYSTEM_ROLE_BUNDLES.hod.includes("student_observation.archive"),
  "hod archive",
);
assert(
  SYSTEM_ROLE_BUNDLES.parent.includes("student_observation.read"),
  "parent read",
);
console.log("OK");

console.log("=== system categories ===");
const codes = SYSTEM_OBSERVATION_CATEGORIES.map((c) => c.code);
for (const c of [
  "academic",
  "behaviour",
  "participation",
  "leadership",
  "creativity",
  "communication",
  "reading",
  "writing",
  "speaking",
  "discipline",
  "social_skills",
]) {
  assert(codes.includes(c), c);
}
assert(codes.length === 11, "11 system categories");
console.log("OK");

console.log("=== append-only + visibility ===");
assert(!mayUpdateRemarkBody(), "never overwrite remark");
assert(OBSERVATION_VISIBILITIES.includes("school"), "school vis");
assert(visibilityFlags("school").visible_to_students === true, "school stu");
assert(
  visibilityFlags("parent_visible").visible_to_guardians === true,
  "parent",
);
assert(visibilityFlags("private").visible_to_guardians === false, "private");
console.log("OK");

console.log("=== record validation ===");
{
  const bad = validateRecordObservationInput({
    studentProfileId: "",
    academicYearId: "",
    remark: "",
    observedOn: "bad",
  });
  assert(
    bad.studentProfileId &&
      bad.academicYearId &&
      bad.category &&
      bad.remark &&
      bad.observedOn,
    "req",
  );
  const good = validateRecordObservationInput({
    studentProfileId: "s1",
    academicYearId: "y1",
    categoryCode: "academic",
    remark: "Strong participation in group work.",
    observedOn: "2026-08-07",
    visibility: "staff",
  });
  assert(Object.keys(good).length === 0, "good record");
}
console.log("OK");

console.log("=== supersede + filter + AI stub validation ===");
{
  assert(
    Object.keys(
      validateSupersedeObservationInput({
        observationId: "o1",
        remark: "Corrected remark",
      }),
    ).length === 0,
    "supersede",
  );
  assert(
    Object.keys(
      validateListFilter({
        academicYearId: "y1",
        categoryCode: "reading",
        observedOnFrom: "2026-04-01",
        observedOnTo: "2026-08-07",
      }),
    ).length === 0,
    "filter",
  );
  assert(
    Object.keys(
      validateQueueAiSummaryInput({
        studentProfileId: "s1",
        academicYearId: "y1",
      }),
    ).length === 0,
    "ai queue",
  );
  const badCat = validateUpsertCategoryInput({ code: "Bad", name: "" });
  assert(badCat.code && badCat.name, "custom cat");
}
console.log("OK");

console.log("\nAll student observation validation smokes passed.");
