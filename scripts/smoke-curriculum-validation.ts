/**
 * Curriculum Engine (E30) validation smoke tests (no DB).
 * Run: npx tsx scripts/smoke-curriculum-validation.ts
 */
import assert from "node:assert/strict";
import { PERMISSION_KEYS } from "../lib/authz/catalog";
import { SYSTEM_ROLE_BUNDLES } from "../lib/authz/bundles";
import { ensureCurriculumCode, ensureNodeCode } from "../lib/curriculum/codes";
import { buildSnapshotJson } from "../lib/curriculum/snapshot";
import type { CurriculumSnapshot } from "../lib/curriculum/types";
import {
  isStructureEditPermission,
  structureEditPermissionKeys,
  validateCloneInput,
  validateHierarchyIntegrity,
  validateOrderUniqueness,
  validatePackInput,
  validateProgressInput,
  validateStructureNodeInput,
} from "../lib/curriculum/validation";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("permission keys in catalog");
const required = [
  "curriculum.pack.read",
  "curriculum.pack.edit",
  "curriculum.pack.publish",
  "curriculum.pack.archive",
  "curriculum.pack.clone",
  "curriculum.structure.edit",
  "curriculum.outcome.edit",
  "curriculum.resource.edit",
  "curriculum.progress.read",
  "curriculum.progress.record",
] as const;
for (const key of required) {
  assert.ok(
    (PERMISSION_KEYS as readonly string[]).includes(key),
    `missing ${key}`,
  );
}
console.log("OK");

section("teacher cannot structure.edit; hod has full set");
assert.ok(
  !SYSTEM_ROLE_BUNDLES.teacher.includes("curriculum.structure.edit"),
);
assert.ok(SYSTEM_ROLE_BUNDLES.teacher.includes("curriculum.pack.read"));
assert.ok(SYSTEM_ROLE_BUNDLES.teacher.includes("curriculum.progress.record"));
assert.ok(SYSTEM_ROLE_BUNDLES.hod.includes("curriculum.structure.edit"));
assert.ok(SYSTEM_ROLE_BUNDLES.hod.includes("curriculum.pack.publish"));
assert.ok(isStructureEditPermission("curriculum.structure.edit"));
assert.deepEqual(structureEditPermissionKeys(), ["curriculum.structure.edit"]);
console.log("OK");

section("pack + structure validation");
assert.ok(validatePackInput({
  academicYearId: "",
  subjectId: "s",
  classId: "c",
  name: "",
}).name);
assert.ok(
  validatePackInput({
    academicYearId: "y",
    subjectId: "s",
    classId: "c",
    name: "Math",
    suggestedTotalHours: -1,
  }).suggestedTotalHours,
);
assert.equal(
  Object.keys(
    validatePackInput({
      academicYearId: "y",
      subjectId: "s",
      classId: "c",
      name: "Math",
    }),
  ).length,
  0,
);

const orphanTopic = validateStructureNodeInput("topic", {
  curriculumId: "cur",
  title: "T",
});
assert.ok(orphanTopic.chapterId);

assert.ok(
  validateStructureNodeInput("unit", {
    curriculumId: "cur",
    title: "U",
    suggestedHours: -2,
  }).suggestedHours,
);
console.log("OK");

section("order uniqueness + hierarchy integrity");
assert.equal(validateOrderUniqueness([0, 1, 2]), null);
assert.match(validateOrderUniqueness([0, 1, 1]) ?? "", /Duplicate/);

const unitIds = new Set(["u1"]);
const chapterUnitIds = new Map([["ch1", "u1"]]);
const topicChapterIds = new Map([["t1", "ch1"]]);
const subtopicTopicIds = new Map([["s1", "t1"]]);
assert.equal(
  validateHierarchyIntegrity({
    unitIds,
    chapterUnitIds,
    topicChapterIds,
    subtopicTopicIds,
  }),
  null,
);
assert.match(
  validateHierarchyIntegrity({
    unitIds,
    chapterUnitIds,
    topicChapterIds: new Map([["t1", "missing-ch"]]),
    subtopicTopicIds,
  }) ?? "",
  /Orphan topic/,
);
console.log("OK");

section("codes");
assert.equal(ensureCurriculumCode("Class 8 Maths", ""), "CLASS_8_MATHS");
assert.equal(ensureNodeCode("Algebra", "alg"), "ALG");
console.log("OK");

section("clone metadata requirements");
assert.ok(validateCloneInput({
  sourceCurriculumId: "",
  targetAcademicYearId: "y",
}).sourceCurriculumId);
assert.equal(
  Object.keys(
    validateCloneInput({
      sourceCurriculumId: "c",
      targetAcademicYearId: "y",
    }),
  ).length,
  0,
);
console.log("OK");

section("progress status enum");
assert.ok(
  validateProgressInput({
    curriculumId: "c",
    curriculumVersionId: "v",
    sectionId: "s",
    employmentId: "e",
    nodeType: "topic",
    nodeId: "n",
    status: "bogus" as "completed",
  }).status,
);
assert.equal(
  Object.keys(
    validateProgressInput({
      curriculumId: "c",
      curriculumVersionId: "v",
      sectionId: "s",
      employmentId: "e",
      nodeType: "topic",
      nodeId: "n",
      status: "completed",
      completionPct: 100,
    }),
  ).length,
  0,
);
console.log("OK");

section("snapshot shape round-trip (unit→subtopic)");
const tree: CurriculumSnapshot = {
  pack: { id: "cur1", name: "Math" },
  units: [{ id: "u1", title: "Unit 1", display_order: 0 }],
  chapters: [{ id: "ch1", unit_id: "u1", title: "Ch 1", display_order: 0 }],
  topics: [{ id: "t1", chapter_id: "ch1", title: "Topic", display_order: 0 }],
  subtopics: [
    { id: "s1", topic_id: "t1", title: "Sub", display_order: 0 },
  ],
  learningOutcomes: [],
  competencies: [],
  outcomeCompetencies: [],
  resources: [],
};
const snap = buildSnapshotJson(tree);
assert.equal(snap.units[0].id, "u1");
assert.equal(snap.subtopics[0].topic_id, "t1");
assert.notEqual(snap.units[0], tree.units[0]);
console.log("OK");

console.log("\nAll curriculum validation smokes passed.");
