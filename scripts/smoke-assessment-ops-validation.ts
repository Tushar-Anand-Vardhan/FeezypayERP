/**
 * Pure validation smoke for Assessment Operations Engine (E11 marks).
 * Run: npx tsx scripts/smoke-assessment-ops-validation.ts
 */

import {
  ASSESSMENT_OPERATIONAL_KINDS,
  MARKS_WORKFLOW_STATUSES,
  TEACHER_EDITABLE_MARKS_WORKFLOWS,
} from "../lib/assessment/ops-types";
import {
  teacherMayEditMarks,
  validateBulkMarksInput,
  validateCorrectMarkInput,
  validateSingleMarkInput,
  validateTeacherAssessmentInput,
  visibilityForMarksWorkflow,
} from "../lib/assessment/ops-validation";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("=== operational kinds ===");
assert(ASSESSMENT_OPERATIONAL_KINDS.includes("class_test"), "class_test");
assert(ASSESSMENT_OPERATIONAL_KINDS.includes("project"), "project");
assert(ASSESSMENT_OPERATIONAL_KINDS.includes("practical"), "practical");
assert(ASSESSMENT_OPERATIONAL_KINDS.includes("assignment"), "assignment");
assert(ASSESSMENT_OPERATIONAL_KINDS.includes("oral"), "oral");
console.log("OK");

console.log("=== workflow + teacher edit ===");
assert(MARKS_WORKFLOW_STATUSES.join(",") === "draft,published,locked", "wf");
assert(TEACHER_EDITABLE_MARKS_WORKFLOWS.includes("draft"), "edit draft");
assert(TEACHER_EDITABLE_MARKS_WORKFLOWS.includes("published"), "edit published");
assert(!TEACHER_EDITABLE_MARKS_WORKFLOWS.includes("locked"), "no edit locked");
assert(teacherMayEditMarks("draft", null), "may edit draft");
assert(teacherMayEditMarks("published", null), "may edit published");
assert(!teacherMayEditMarks("locked", null), "may not edit locked");
assert(!teacherMayEditMarks("published", "2026-01-01"), "locked_at blocks");
console.log("OK");

console.log("=== visibility ===");
assert(!visibilityForMarksWorkflow("draft").visible_to_guardians, "draft hide");
assert(visibilityForMarksWorkflow("published").visible_to_students, "pub show");
assert(visibilityForMarksWorkflow("locked").visible_to_guardians, "lock show");
console.log("OK");

console.log("=== teacher assessment validation ===");
{
  const bad = validateTeacherAssessmentInput({
    academicYearId: "",
    name: "",
    operationalKind: "class_test",
    subjectId: "",
    classId: "",
    maxMarks: 0,
  });
  assert(bad.academicYearId && bad.name && bad.subjectId, "required fields");
  const good = validateTeacherAssessmentInput({
    academicYearId: "y1",
    name: "Surprise quiz",
    operationalKind: "class_test",
    subjectId: "s1",
    classId: "c1",
    maxMarks: 20,
    passMarks: 8,
  });
  assert(Object.keys(good).length === 0, "good teacher assessment");
}
console.log("OK");

console.log("=== single + bulk marks ===");
{
  const bad = validateSingleMarkInput({
    examDefinitionId: "e1",
    subjectId: "s1",
    studentProfileId: "p1",
    academicYearId: "y1",
  });
  assert(bad.marksObtained, "marks required");

  const absent = validateSingleMarkInput({
    examDefinitionId: "e1",
    subjectId: "s1",
    studentProfileId: "p1",
    academicYearId: "y1",
    isAbsent: true,
  });
  assert(Object.keys(absent).length === 0, "absent ok");

  const over = validateSingleMarkInput({
    examDefinitionId: "e1",
    subjectId: "s1",
    studentProfileId: "p1",
    academicYearId: "y1",
    marksObtained: 25,
    maxMarks: 20,
  });
  assert(over.marksObtained, "over max");

  const bulk = validateBulkMarksInput({
    examDefinitionId: "e1",
    subjectId: "s1",
    academicYearId: "y1",
    defaultMaxMarks: 50,
    marks: [
      { studentProfileId: "p1", marksObtained: 40 },
      { studentProfileId: "p2", isAbsent: true },
    ],
  });
  assert(Object.keys(bulk).length === 0, "bulk ok");
}
console.log("OK");

console.log("=== correction ===");
{
  const bad = validateCorrectMarkInput({
    examResultId: "",
    reason: "",
    marksObtained: 10,
    maxMarks: 20,
  });
  assert(bad.examResultId && bad.reason, "correction requires id+reason");
  const good = validateCorrectMarkInput({
    examResultId: "r1",
    reason: "Data entry error",
    marksObtained: 18,
    maxMarks: 20,
  });
  assert(Object.keys(good).length === 0, "good correction");
}
console.log("OK");

console.log("\nAll assessment ops smoke checks passed.");
