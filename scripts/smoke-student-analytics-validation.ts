/**
 * Pure deterministic smoke for Student Analytics Engine (E22).
 * Run: npx tsx scripts/smoke-student-analytics-validation.ts
 */

import { deriveInsights, validateGenerateInput } from "../lib/student-analytics/rules";
import type { StudentAnalyticsAggregates } from "../lib/student-analytics/types";
import {
  ANALYTICS_THRESHOLDS,
  GENERATOR_VERSION,
} from "../lib/student-analytics/types";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function emptyAgg(
  over: Partial<StudentAnalyticsAggregates> = {},
): StudentAnalyticsAggregates {
  return {
    attendance: {
      total: 0,
      byStatus: {},
      presentRate: null,
      absentRate: null,
      lateCount: 0,
      monthly: [],
      ...over.attendance,
    },
    assessment: {
      totalResults: 0,
      publishedCount: 0,
      absentCount: 0,
      overallAveragePercent: null,
      passRate: null,
      bySubject: [],
      byExam: [],
      ...over.assessment,
    },
    subjectTrends: over.subjectTrends ?? [],
    participation: {
      eventCount: 0,
      attendedCount: 0,
      awardCount: 0,
      roles: {},
      ...over.participation,
    },
    behaviour: {
      total: 0,
      byKind: {},
      bySeverity: {},
      positiveCount: 0,
      disciplinaryCount: 0,
      openFollowUps: 0,
      ...over.behaviour,
    },
    achievements: over.achievements ?? [],
    teacherRemarks: over.teacherRemarks ?? [],
  };
}

console.log("=== generator + thresholds ===");
assert(GENERATOR_VERSION === "1.0.0", "version");
assert(ANALYTICS_THRESHOLDS.attendanceRiskRate === 0.75, "att risk");
assert(ANALYTICS_THRESHOLDS.subjectStrengthPercent === 75, "subject strength");
console.log("OK");

console.log("=== input validation ===");
{
  const bad = validateGenerateInput({});
  assert(bad.studentProfileId && bad.academicYearId, "required");
  const good = validateGenerateInput({
    studentProfileId: "s1",
    academicYearId: "y1",
  });
  assert(Object.keys(good).length === 0, "good");
}
console.log("OK");

console.log("=== deterministic strengths ===");
{
  const insights = deriveInsights(
    emptyAgg({
      attendance: {
        total: 20,
        byStatus: { present: 19, absent: 1 },
        presentRate: 0.97,
        absentRate: 0.05,
        lateCount: 0,
        monthly: [],
      },
      assessment: {
        totalResults: 4,
        publishedCount: 4,
        absentCount: 0,
        overallAveragePercent: 82,
        passRate: 1,
        bySubject: [
          {
            subjectId: "math",
            subjectName: "Math",
            averagePercent: 88,
            resultCount: 3,
            trendDelta: 12,
            points: [],
          },
        ],
        byExam: [],
      },
      behaviour: {
        total: 3,
        byKind: { positive: 3 },
        bySeverity: { low: 3 },
        positiveCount: 3,
        disciplinaryCount: 0,
        openFollowUps: 0,
      },
      participation: {
        eventCount: 2,
        attendedCount: 2,
        awardCount: 1,
        roles: { participant: 2 },
      },
      achievements: [
        {
          source: "event_award",
          title: "1st",
          occurredOn: "2026-01-01",
          refId: "a1",
        },
        {
          source: "conduct_commendation",
          title: "Helpful",
          occurredOn: "2026-02-01",
          refId: "a2",
        },
      ],
    }),
  );
  assert(insights.strengths.some((s) => s.code === "attendance.excellent"), "att");
  assert(
    insights.strengths.some((s) => s.code === "assessment.strong_overall"),
    "assess",
  );
  assert(insights.strengths.some((s) => s.code.startsWith("subject.strong")), "subj");
  assert(insights.strengths.some((s) => s.code === "behaviour.positive"), "beh");
  assert(insights.risks.length === 0, "no risks");
}
console.log("OK");

console.log("=== deterministic risks ===");
{
  const insights = deriveInsights(
    emptyAgg({
      attendance: {
        total: 20,
        byStatus: { present: 10, absent: 10 },
        presentRate: 0.5,
        absentRate: 0.5,
        lateCount: 6,
        monthly: [],
      },
      assessment: {
        totalResults: 4,
        publishedCount: 4,
        absentCount: 0,
        overallAveragePercent: 35,
        passRate: 0.25,
        bySubject: [
          {
            subjectId: "eng",
            subjectName: "English",
            averagePercent: 30,
            resultCount: 3,
            trendDelta: -15,
            points: [],
          },
        ],
        byExam: [],
      },
      behaviour: {
        total: 4,
        byKind: { disciplinary: 3, warning: 1 },
        bySeverity: { high: 1, medium: 3 },
        positiveCount: 0,
        disciplinaryCount: 4,
        openFollowUps: 2,
      },
    }),
  );
  assert(
    insights.risks.some((r) => r.code === "attendance.chronic_absence"),
    "att risk",
  );
  assert(
    insights.risks.some((r) => r.code === "assessment.failing_risk"),
    "assess risk",
  );
  assert(insights.risks.some((r) => r.code.startsWith("subject.risk")), "subj risk");
  assert(insights.risks.some((r) => r.code.startsWith("subject.declining")), "decline");
  assert(
    insights.risks.some((r) => r.code === "behaviour.disciplinary_pattern"),
    "beh risk",
  );
  assert(insights.weaknesses.length >= 2, "weaknesses");
}
console.log("OK");

console.log("=== idempotent same input ===");
{
  const a = emptyAgg({
    attendance: {
      total: 10,
      byStatus: { present: 8, absent: 2 },
      presentRate: 0.8,
      absentRate: 0.2,
      lateCount: 0,
      monthly: [],
    },
  });
  const i1 = deriveInsights(a);
  const i2 = deriveInsights(a);
  assert(
    JSON.stringify(i1) === JSON.stringify(i2),
    "deterministic equality",
  );
}
console.log("OK");

console.log("\nAll student analytics validation checks passed.");
