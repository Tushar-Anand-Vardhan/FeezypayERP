import type {
  DeterministicInsight,
  TeacherAnalyticsAggregates,
  TeacherAnalyticsInsights,
} from "@/lib/teacher-analytics/types";
import { TEACHER_ANALYTICS_THRESHOLDS } from "@/lib/teacher-analytics/types";

/**
 * Pure deterministic insight rules for teachers. Same inputs → same outputs. No AI.
 */
export function deriveTeacherInsights(
  aggregates: TeacherAnalyticsAggregates,
): TeacherAnalyticsInsights {
  const strengths: DeterministicInsight[] = [];
  const weaknesses: DeterministicInsight[] = [];
  const risks: DeterministicInsight[] = [];
  const t = TEACHER_ANALYTICS_THRESHOLDS;

  const att = aggregates.attendanceCompletion;
  const assess = aggregates.assessmentCompletion;
  const hw = aggregates.homeworkCompletion;
  const perf = aggregates.averageStudentPerformance;
  const load = aggregates.workload;
  const dept = aggregates.departmentContribution;

  if (att.sessionsExpected >= 3 && att.completionRateByTeacher != null) {
    if (att.completionRateByTeacher >= t.attendanceCompletionStrength) {
      strengths.push({
        code: "attendance.completion_excellent",
        category: "strength",
        severity: "info",
        title: "Strong attendance completion",
        detail: `Teacher completed ${(att.completionRateByTeacher * 100).toFixed(1)}% of expected sessions.`,
        evidence: {
          completionRateByTeacher: att.completionRateByTeacher,
          sessionsExpected: att.sessionsExpected,
        },
      });
    } else if (att.completionRateByTeacher < t.attendanceCompletionRisk) {
      risks.push({
        code: "attendance.completion_risk",
        category: "risk",
        severity: "high",
        title: "Attendance marking risk",
        detail: `Only ${(att.completionRateByTeacher * 100).toFixed(1)}% of expected sessions marked by this teacher.`,
        evidence: {
          completionRateByTeacher: att.completionRateByTeacher,
          threshold: t.attendanceCompletionRisk,
        },
      });
      weaknesses.push({
        code: "attendance.completion_low",
        category: "weakness",
        severity: "high",
        title: "Low attendance completion",
        detail: `${att.sessionsCompletedByTeacher}/${att.sessionsExpected} sessions completed.`,
        evidence: {
          sessionsCompletedByTeacher: att.sessionsCompletedByTeacher,
          sessionsExpected: att.sessionsExpected,
        },
      });
    } else if (att.completionRateByTeacher < t.attendanceCompletionWatch) {
      weaknesses.push({
        code: "attendance.completion_watch",
        category: "weakness",
        severity: "medium",
        title: "Attendance completion below target",
        detail: `${(att.completionRateByTeacher * 100).toFixed(1)}% completion.`,
        evidence: { completionRateByTeacher: att.completionRateByTeacher },
      });
    }
  }

  if (assess.markSessionsTotal >= 2 && assess.completionRate != null) {
    if (assess.completionRate >= t.assessmentCompletionStrength) {
      strengths.push({
        code: "assessment.completion_excellent",
        category: "strength",
        severity: "info",
        title: "Strong assessment completion",
        detail: `${(assess.completionRate * 100).toFixed(1)}% mark sessions published/locked.`,
        evidence: { completionRate: assess.completionRate },
      });
    } else if (assess.completionRate < t.assessmentCompletionRisk) {
      risks.push({
        code: "assessment.completion_risk",
        category: "risk",
        severity: "high",
        title: "Assessment entry risk",
        detail: `Only ${(assess.completionRate * 100).toFixed(1)}% sessions published/locked; ${assess.markSessionsDraft} still draft.`,
        evidence: {
          completionRate: assess.completionRate,
          draft: assess.markSessionsDraft,
        },
      });
    } else if (assess.completionRate < t.assessmentCompletionWatch) {
      weaknesses.push({
        code: "assessment.completion_watch",
        category: "weakness",
        severity: "medium",
        title: "Assessment completion below target",
        detail: `${(assess.completionRate * 100).toFixed(1)}% published/locked.`,
        evidence: { completionRate: assess.completionRate },
      });
    }
  }

  if (hw.assignedTotal >= 2 && hw.gradingRate != null) {
    if (hw.gradingRate >= t.homeworkGradingStrength) {
      strengths.push({
        code: "homework.grading_excellent",
        category: "strength",
        severity: "info",
        title: "Strong homework grading",
        detail: `${(hw.gradingRate * 100).toFixed(1)}% of submissions graded.`,
        evidence: { gradingRate: hw.gradingRate },
      });
    } else if (hw.gradingRate < t.homeworkGradingWatch) {
      weaknesses.push({
        code: "homework.grading_low",
        category: "weakness",
        severity: "medium",
        title: "Homework grading backlog",
        detail: `${hw.submissionsGraded}/${hw.submissionsTotal} graded.`,
        evidence: {
          gradingRate: hw.gradingRate,
          submissionsTotal: hw.submissionsTotal,
        },
      });
    }
  }

  if (perf.resultCount >= 5 && perf.averagePercent != null) {
    if (perf.averagePercent >= t.studentPerformanceStrength) {
      strengths.push({
        code: "students.performance_strong",
        category: "strength",
        severity: "info",
        title: "Strong class performance",
        detail: `Students average ${perf.averagePercent.toFixed(1)}% in taught subjects.`,
        evidence: { averagePercent: perf.averagePercent },
      });
    } else if (perf.averagePercent < t.studentPerformanceRisk) {
      risks.push({
        code: "students.performance_risk",
        category: "risk",
        severity: "high",
        title: "Class performance risk",
        detail: `Average ${perf.averagePercent.toFixed(1)}% is below ${t.studentPerformanceRisk}%.`,
        evidence: { averagePercent: perf.averagePercent },
      });
    } else if (perf.averagePercent < t.studentPerformanceWatch) {
      weaknesses.push({
        code: "students.performance_watch",
        category: "weakness",
        severity: "medium",
        title: "Class performance below target",
        detail: `Average ${perf.averagePercent.toFixed(1)}%.`,
        evidence: { averagePercent: perf.averagePercent },
      });
    }
  }

  if (load.weeklyPeriods >= t.highWorkloadPeriods) {
    risks.push({
      code: "workload.high_periods",
      category: "risk",
      severity: "medium",
      title: "High teaching load",
      detail: `${load.weeklyPeriods} weekly periods scheduled.`,
      evidence: { weeklyPeriods: load.weeklyPeriods },
    });
  }
  if (load.openHomework >= t.highOpenHomework) {
    weaknesses.push({
      code: "workload.open_homework",
      category: "weakness",
      severity: "low",
      title: "Many open homework items",
      detail: `${load.openHomework} open homework assignments.`,
      evidence: { openHomework: load.openHomework },
    });
  }

  if (dept.isHod) {
    strengths.push({
      code: "department.hod",
      category: "strength",
      severity: "info",
      title: "Department head",
      detail: "Employment flagged as HOD with department memberships.",
      evidence: { departmentIds: dept.departmentIds },
    });
  }
  if (dept.teachingAssignments >= 2) {
    strengths.push({
      code: "department.teaching_assignments",
      category: "strength",
      severity: "info",
      title: "Active department teaching assignments",
      detail: `${dept.teachingAssignments} department subject assignment(s).`,
      evidence: { teachingAssignments: dept.teachingAssignments },
    });
  }

  if (aggregates.classesTaught.sectionCount >= 3) {
    strengths.push({
      code: "classes.breadth",
      category: "strength",
      severity: "info",
      title: "Broad teaching coverage",
      detail: `Teaches ${aggregates.classesTaught.sectionCount} sections across ${aggregates.classesTaught.subjectCount} subjects.`,
      evidence: {
        sectionCount: aggregates.classesTaught.sectionCount,
        subjectCount: aggregates.classesTaught.subjectCount,
      },
    });
  }

  return { strengths, weaknesses, risks };
}

export function validateGenerateTeacherInput(input: {
  employmentId?: string;
  academicYearId?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.employmentId?.trim()) {
    errors.employmentId = "Employment is required.";
  }
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  return errors;
}
