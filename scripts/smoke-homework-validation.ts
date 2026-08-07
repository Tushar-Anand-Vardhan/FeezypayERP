/**
 * Pure validation smoke for Homework & Assignment Engine.
 * Run: npx tsx scripts/smoke-homework-validation.ts
 */

import {
  ASSIGNMENT_KINDS,
  HOMEWORK_STATUSES,
  SUBMISSION_STATUSES,
} from "../lib/homework/types";
import {
  computeIsLate,
  validateCreateHomeworkInput,
  validateGradeSubmissionInput,
  validateRecordSubmissionInput,
  validateUpdateHomeworkInput,
} from "../lib/homework/validation";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("=== kinds + statuses ===");
for (const k of ["homework", "assignment", "project"] as const) {
  assert(ASSIGNMENT_KINDS.includes(k), k);
}
assert(HOMEWORK_STATUSES.includes("draft"), "draft");
assert(HOMEWORK_STATUSES.includes("assigned"), "assigned");
assert(HOMEWORK_STATUSES.includes("closed"), "closed");
assert(SUBMISSION_STATUSES.includes("late"), "late");
assert(SUBMISSION_STATUSES.includes("graded"), "graded");
console.log("OK");

console.log("=== create validation ===");
{
  const bad = validateCreateHomeworkInput({
    academicYearId: "",
    employmentId: "",
    sectionId: "",
    assignmentKind: "homework",
    title: "",
  });
  assert(
    bad.academicYearId &&
      bad.employmentId &&
      bad.sectionId &&
      bad.title,
    "required",
  );

  const kind = validateCreateHomeworkInput({
    academicYearId: "y1",
    employmentId: "e1",
    sectionId: "s1",
    assignmentKind: "quiz" as never,
    title: "X",
  });
  assert(kind.assignmentKind, "bad kind");

  const dates = validateCreateHomeworkInput({
    academicYearId: "y1",
    employmentId: "e1",
    sectionId: "s1",
    assignmentKind: "project",
    title: "Science fair",
    assignedOn: "2026-08-01",
    dueOn: "2026-07-01",
  });
  assert(dates.dueOn, "due before assigned");

  const late = validateCreateHomeworkInput({
    academicYearId: "y1",
    employmentId: "e1",
    sectionId: "s1",
    assignmentKind: "assignment",
    title: "Essay",
    dueOn: "2026-08-10",
    lateUntil: "2026-08-05",
  });
  assert(late.lateUntil, "late before due");

  const good = validateCreateHomeworkInput({
    academicYearId: "y1",
    employmentId: "e1",
    sectionId: "s1",
    assignmentKind: "homework",
    title: "Chapter 3 Qs",
    dueOn: "2026-08-10",
    lateUntil: "2026-08-12",
    maxMarks: 20,
    allowLate: true,
    parentVisible: true,
    publishNow: true,
  });
  assert(Object.keys(good).length === 0, "good create");
}
console.log("OK");

console.log("=== late computation ===");
{
  assert(
    !computeIsLate({
      submittedAt: "2026-08-10T10:00:00.000Z",
      dueOn: "2026-08-10",
      dueAt: null,
      allowLate: true,
      lateUntil: "2026-08-12",
    }),
    "on due day not late",
  );
  assert(
    computeIsLate({
      submittedAt: "2026-08-11T10:00:00.000Z",
      dueOn: "2026-08-10",
      dueAt: null,
      allowLate: true,
      lateUntil: "2026-08-12",
    }),
    "after due is late",
  );
  assert(
    computeIsLate({
      submittedAt: "2026-08-11T12:00:00.000Z",
      dueOn: null,
      dueAt: "2026-08-11T11:00:00.000Z",
      allowLate: false,
      lateUntil: null,
    }),
    "after dueAt late",
  );
}
console.log("OK");

console.log("=== submission / grade validation ===");
{
  const bad = validateRecordSubmissionInput({
    homeworkId: "",
    studentProfileId: "",
  });
  assert(bad.homeworkId && bad.studentProfileId, "submission required");

  const grade = validateGradeSubmissionInput({
    submissionId: "sub1",
    marksAwarded: -1,
  });
  assert(grade.marksAwarded, "negative marks");

  const ok = validateGradeSubmissionInput({
    submissionId: "sub1",
    marksAwarded: 18,
    teacherFeedback: "Good work",
  });
  assert(Object.keys(ok).length === 0, "good grade");

  const upd = validateUpdateHomeworkInput({ id: "" });
  assert(upd.id, "update id");
}
console.log("OK");

console.log("\nAll homework validation checks passed.");
