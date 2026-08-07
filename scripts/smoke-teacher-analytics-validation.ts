/**
 * Pure deterministic smoke for Teacher Analytics Engine (E22).
 * Run: npx tsx scripts/smoke-teacher-analytics-validation.ts
 */

import {
  deriveTeacherInsights,
  validateGenerateTeacherInput,
} from "../lib/teacher-analytics/rules";
import type { TeacherAnalyticsAggregates } from "../lib/teacher-analytics/types";
import {
  TEACHER_ANALYTICS_THRESHOLDS,
  TEACHER_GENERATOR_VERSION,
} from "../lib/teacher-analytics/types";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function emptyAgg(
  over: Partial<TeacherAnalyticsAggregates> = {},
): TeacherAnalyticsAggregates {
  return {
    attendanceCompletion: {
      taughtSectionCount: 0,
      sessionsExpected: 0,
      sessionsCompletedByTeacher: 0,
      sessionsCompletedOnSections: 0,
      completionRateByTeacher: null,
      sectionCoverageRate: null,
      byWorkflow: {},
      ...over.attendanceCompletion,
    },
    assessmentCompletion: {
      markSessionsTotal: 0,
      markSessionsPublishedOrLocked: 0,
      markSessionsDraft: 0,
      completionRate: null,
      resultsEntered: 0,
      teacherCreatedAssessments: 0,
      ...over.assessmentCompletion,
    },
    homeworkCompletion: {
      assignedTotal: 0,
      assignedOpen: 0,
      assignedClosed: 0,
      submissionsTotal: 0,
      submissionsGraded: 0,
      gradingRate: null,
      ...over.homeworkCompletion,
    },
    averageStudentPerformance: {
      resultCount: 0,
      averagePercent: null,
      passRate: null,
      bySubject: [],
      ...over.averageStudentPerformance,
    },
    workload: {
      weeklyPeriods: 0,
      uniqueSections: 0,
      uniqueSubjects: 0,
      openHomework: 0,
      draftMarkSessions: 0,
      workloadScore: 0,
      ...over.workload,
    },
    classesTaught: {
      sectionIds: [],
      classIds: [],
      subjectIds: [],
      sectionCount: 0,
      classCount: 0,
      subjectCount: 0,
      slots: [],
      ...over.classesTaught,
    },
    departmentContribution: {
      memberships: [],
      teachingAssignments: 0,
      isHod: false,
      departmentIds: [],
      ...over.departmentContribution,
    },
    aiInsights: {
      status: "not_built",
      note: "E23 FUTURE",
      ...over.aiInsights,
    },
  };
}

console.log("=== generator + thresholds ===");
assert(TEACHER_GENERATOR_VERSION === "1.0.0", "version");
assert(TEACHER_ANALYTICS_THRESHOLDS.attendanceCompletionRisk === 0.5, "att");
assert(TEACHER_ANALYTICS_THRESHOLDS.highWorkloadPeriods === 30, "workload");
console.log("OK");

console.log("=== input validation ===");
{
  const bad = validateGenerateTeacherInput({});
  assert(bad.employmentId && bad.academicYearId, "required");
  const good = validateGenerateTeacherInput({
    employmentId: "e1",
    academicYearId: "y1",
  });
  assert(Object.keys(good).length === 0, "good");
}
console.log("OK");

console.log("=== deterministic strengths ===");
{
  const insights = deriveTeacherInsights(
    emptyAgg({
      attendanceCompletion: {
        taughtSectionCount: 3,
        sessionsExpected: 10,
        sessionsCompletedByTeacher: 10,
        sessionsCompletedOnSections: 10,
        completionRateByTeacher: 1,
        sectionCoverageRate: 1,
        byWorkflow: { approved: 10 },
      },
      assessmentCompletion: {
        markSessionsTotal: 4,
        markSessionsPublishedOrLocked: 4,
        markSessionsDraft: 0,
        completionRate: 1,
        resultsEntered: 40,
        teacherCreatedAssessments: 1,
      },
      homeworkCompletion: {
        assignedTotal: 5,
        assignedOpen: 1,
        assignedClosed: 4,
        submissionsTotal: 20,
        submissionsGraded: 18,
        gradingRate: 0.9,
      },
      averageStudentPerformance: {
        resultCount: 20,
        averagePercent: 78,
        passRate: 0.95,
        bySubject: [],
      },
      classesTaught: {
        sectionIds: ["s1", "s2", "s3"],
        classIds: ["c1"],
        subjectIds: ["sub1", "sub2"],
        sectionCount: 3,
        classCount: 1,
        subjectCount: 2,
        slots: [],
      },
      departmentContribution: {
        memberships: [
          { departmentId: "d1", departmentName: "Science", role: "head" },
        ],
        teachingAssignments: 2,
        isHod: true,
        departmentIds: ["d1"],
      },
    }),
  );
  assert(
    insights.strengths.some((s) => s.code === "attendance.completion_excellent"),
    "att",
  );
  assert(
    insights.strengths.some((s) => s.code === "assessment.completion_excellent"),
    "assess",
  );
  assert(
    insights.strengths.some((s) => s.code === "homework.grading_excellent"),
    "hw",
  );
  assert(insights.strengths.some((s) => s.code === "department.hod"), "hod");
  assert(insights.risks.length === 0, "no risks");
}
console.log("OK");

console.log("=== deterministic risks ===");
{
  const insights = deriveTeacherInsights(
    emptyAgg({
      attendanceCompletion: {
        taughtSectionCount: 2,
        sessionsExpected: 10,
        sessionsCompletedByTeacher: 2,
        sessionsCompletedOnSections: 4,
        completionRateByTeacher: 0.2,
        sectionCoverageRate: 0.4,
        byWorkflow: { draft: 6, submitted: 4 },
      },
      assessmentCompletion: {
        markSessionsTotal: 5,
        markSessionsPublishedOrLocked: 1,
        markSessionsDraft: 4,
        completionRate: 0.2,
        resultsEntered: 5,
        teacherCreatedAssessments: 0,
      },
      homeworkCompletion: {
        assignedTotal: 10,
        assignedOpen: 9,
        assignedClosed: 1,
        submissionsTotal: 30,
        submissionsGraded: 5,
        gradingRate: 0.16,
      },
      averageStudentPerformance: {
        resultCount: 15,
        averagePercent: 32,
        passRate: 0.2,
        bySubject: [],
      },
      workload: {
        weeklyPeriods: 35,
        uniqueSections: 5,
        uniqueSubjects: 4,
        openHomework: 9,
        draftMarkSessions: 4,
        workloadScore: 60,
      },
    }),
  );
  assert(
    insights.risks.some((r) => r.code === "attendance.completion_risk"),
    "att risk",
  );
  assert(
    insights.risks.some((r) => r.code === "assessment.completion_risk"),
    "assess risk",
  );
  assert(
    insights.risks.some((r) => r.code === "students.performance_risk"),
    "perf risk",
  );
  assert(
    insights.risks.some((r) => r.code === "workload.high_periods"),
    "workload",
  );
  assert(insights.weaknesses.length >= 2, "weaknesses");
}
console.log("OK");

console.log("=== ai placeholder + deterministic equality ===");
{
  const a = emptyAgg({
    attendanceCompletion: {
      taughtSectionCount: 1,
      sessionsExpected: 5,
      sessionsCompletedByTeacher: 4,
      sessionsCompletedOnSections: 5,
      completionRateByTeacher: 0.8,
      sectionCoverageRate: 1,
      byWorkflow: {},
    },
  });
  assert(a.aiInsights.status === "not_built", "ai not built");
  assert(
    JSON.stringify(deriveTeacherInsights(a)) ===
      JSON.stringify(deriveTeacherInsights(a)),
    "deterministic",
  );
}
console.log("OK");

console.log("\nAll teacher analytics validation checks passed.");
