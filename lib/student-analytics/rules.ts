import type {
  DeterministicInsight,
  StudentAnalyticsAggregates,
  StudentAnalyticsInsights,
} from "@/lib/student-analytics/types";
import { ANALYTICS_THRESHOLDS } from "@/lib/student-analytics/types";

/**
 * Pure deterministic insight rules. Same inputs → same outputs. No AI.
 */
export function deriveInsights(
  aggregates: StudentAnalyticsAggregates,
): StudentAnalyticsInsights {
  const strengths: DeterministicInsight[] = [];
  const weaknesses: DeterministicInsight[] = [];
  const risks: DeterministicInsight[] = [];

  const t = ANALYTICS_THRESHOLDS;
  const att = aggregates.attendance;
  const assess = aggregates.assessment;
  const beh = aggregates.behaviour;
  const part = aggregates.participation;

  // --- Attendance ---
  if (att.total >= 5 && att.presentRate != null) {
    if (att.presentRate >= t.attendanceStrengthRate) {
      strengths.push({
        code: "attendance.excellent",
        category: "strength",
        severity: "info",
        title: "Excellent attendance",
        detail: `Present rate ${(att.presentRate * 100).toFixed(1)}% across ${att.total} recorded days.`,
        evidence: { presentRate: att.presentRate, total: att.total },
      });
    } else if (att.presentRate < t.attendanceRiskRate) {
      risks.push({
        code: "attendance.chronic_absence",
        category: "risk",
        severity: "high",
        title: "Attendance risk",
        detail: `Present rate ${(att.presentRate * 100).toFixed(1)}% is below ${(t.attendanceRiskRate * 100).toFixed(0)}% threshold.`,
        evidence: { presentRate: att.presentRate, threshold: t.attendanceRiskRate },
      });
      weaknesses.push({
        code: "attendance.low",
        category: "weakness",
        severity: "high",
        title: "Low attendance",
        detail: `Absent/leave pressure — present rate ${(att.presentRate * 100).toFixed(1)}%.`,
        evidence: { presentRate: att.presentRate, byStatus: att.byStatus },
      });
    } else if (att.presentRate < t.attendanceWatchRate) {
      weaknesses.push({
        code: "attendance.watch",
        category: "weakness",
        severity: "medium",
        title: "Attendance below target",
        detail: `Present rate ${(att.presentRate * 100).toFixed(1)}% is under ${(t.attendanceWatchRate * 100).toFixed(0)}%.`,
        evidence: { presentRate: att.presentRate, threshold: t.attendanceWatchRate },
      });
    }
    if (att.lateCount >= t.lateAttendanceWatch) {
      weaknesses.push({
        code: "attendance.late_pattern",
        category: "weakness",
        severity: "low",
        title: "Frequent late arrivals",
        detail: `${att.lateCount} late marks recorded.`,
        evidence: { lateCount: att.lateCount },
      });
    }
  }

  // --- Assessment overall ---
  if (assess.publishedCount >= 2 && assess.overallAveragePercent != null) {
    if (assess.overallAveragePercent >= t.subjectStrengthPercent) {
      strengths.push({
        code: "assessment.strong_overall",
        category: "strength",
        severity: "info",
        title: "Strong overall assessment performance",
        detail: `Average ${assess.overallAveragePercent.toFixed(1)}% across ${assess.publishedCount} published results.`,
        evidence: {
          overallAveragePercent: assess.overallAveragePercent,
          publishedCount: assess.publishedCount,
        },
      });
    } else if (assess.overallAveragePercent < t.subjectRiskPercent) {
      risks.push({
        code: "assessment.failing_risk",
        category: "risk",
        severity: "high",
        title: "Academic performance risk",
        detail: `Overall average ${assess.overallAveragePercent.toFixed(1)}% is below ${t.subjectRiskPercent}%.`,
        evidence: {
          overallAveragePercent: assess.overallAveragePercent,
          threshold: t.subjectRiskPercent,
        },
      });
      weaknesses.push({
        code: "assessment.weak_overall",
        category: "weakness",
        severity: "high",
        title: "Weak overall marks",
        detail: `Average ${assess.overallAveragePercent.toFixed(1)}% needs intervention.`,
        evidence: { overallAveragePercent: assess.overallAveragePercent },
      });
    } else if (assess.overallAveragePercent < t.subjectWeakPercent) {
      weaknesses.push({
        code: "assessment.below_target",
        category: "weakness",
        severity: "medium",
        title: "Marks below target band",
        detail: `Average ${assess.overallAveragePercent.toFixed(1)}% is under ${t.subjectWeakPercent}%.`,
        evidence: {
          overallAveragePercent: assess.overallAveragePercent,
          threshold: t.subjectWeakPercent,
        },
      });
    }
  }

  // --- Subject trends ---
  for (const sub of assess.bySubject) {
    if (sub.resultCount < 2 || sub.averagePercent == null) continue;
    if (sub.averagePercent >= t.subjectStrengthPercent) {
      strengths.push({
        code: `subject.strong.${sub.subjectId}`,
        category: "strength",
        severity: "info",
        title: `Strength in ${sub.subjectName ?? "subject"}`,
        detail: `Average ${sub.averagePercent.toFixed(1)}% over ${sub.resultCount} results.`,
        evidence: {
          subjectId: sub.subjectId,
          averagePercent: sub.averagePercent,
          trendDelta: sub.trendDelta,
        },
      });
    } else if (sub.averagePercent < t.subjectRiskPercent) {
      risks.push({
        code: `subject.risk.${sub.subjectId}`,
        category: "risk",
        severity: "high",
        title: `At-risk subject: ${sub.subjectName ?? "unknown"}`,
        detail: `Average ${sub.averagePercent.toFixed(1)}% is below ${t.subjectRiskPercent}%.`,
        evidence: {
          subjectId: sub.subjectId,
          averagePercent: sub.averagePercent,
        },
      });
      weaknesses.push({
        code: `subject.weak.${sub.subjectId}`,
        category: "weakness",
        severity: "high",
        title: `Weakness in ${sub.subjectName ?? "subject"}`,
        detail: `Average ${sub.averagePercent.toFixed(1)}%.`,
        evidence: {
          subjectId: sub.subjectId,
          averagePercent: sub.averagePercent,
        },
      });
    } else if (sub.averagePercent < t.subjectWeakPercent) {
      weaknesses.push({
        code: `subject.watch.${sub.subjectId}`,
        category: "weakness",
        severity: "medium",
        title: `Needs support: ${sub.subjectName ?? "subject"}`,
        detail: `Average ${sub.averagePercent.toFixed(1)}%.`,
        evidence: {
          subjectId: sub.subjectId,
          averagePercent: sub.averagePercent,
        },
      });
    }

    if (sub.trendDelta != null && sub.trendDelta <= -10) {
      risks.push({
        code: `subject.declining.${sub.subjectId}`,
        category: "risk",
        severity: "medium",
        title: `Declining trend: ${sub.subjectName ?? "subject"}`,
        detail: `Recent vs earlier average dropped by ${Math.abs(sub.trendDelta).toFixed(1)} points.`,
        evidence: {
          subjectId: sub.subjectId,
          trendDelta: sub.trendDelta,
        },
      });
    } else if (sub.trendDelta != null && sub.trendDelta >= 10) {
      strengths.push({
        code: `subject.improving.${sub.subjectId}`,
        category: "strength",
        severity: "info",
        title: `Improving: ${sub.subjectName ?? "subject"}`,
        detail: `Recent vs earlier average rose by ${sub.trendDelta.toFixed(1)} points.`,
        evidence: {
          subjectId: sub.subjectId,
          trendDelta: sub.trendDelta,
        },
      });
    }
  }

  // --- Behaviour ---
  if (beh.positiveCount >= 2) {
    strengths.push({
      code: "behaviour.positive",
      category: "strength",
      severity: "info",
      title: "Positive behaviour record",
      detail: `${beh.positiveCount} positive/commendation remarks.`,
      evidence: { positiveCount: beh.positiveCount, byKind: beh.byKind },
    });
  }
  if (beh.disciplinaryCount >= t.disciplinaryRiskCount) {
    risks.push({
      code: "behaviour.disciplinary_pattern",
      category: "risk",
      severity: "medium",
      title: "Disciplinary pattern",
      detail: `${beh.disciplinaryCount} disciplinary/warning remarks this year.`,
      evidence: { disciplinaryCount: beh.disciplinaryCount },
    });
    weaknesses.push({
      code: "behaviour.conduct",
      category: "weakness",
      severity: "medium",
      title: "Conduct concerns",
      detail: "Multiple disciplinary or warning remarks.",
      evidence: { byKind: beh.byKind, bySeverity: beh.bySeverity },
    });
  }
  const highSev =
    (beh.bySeverity.high ?? 0) + (beh.bySeverity.critical ?? 0);
  if (highSev >= t.highSeverityRiskCount) {
    risks.push({
      code: "behaviour.high_severity",
      category: "risk",
      severity: "high",
      title: "High-severity conduct",
      detail: `${highSev} high/critical severity remark(s).`,
      evidence: { highSeverityCount: highSev },
    });
  }
  if (beh.openFollowUps > 0) {
    risks.push({
      code: "behaviour.open_followups",
      category: "risk",
      severity: "low",
      title: "Open behaviour follow-ups",
      detail: `${beh.openFollowUps} pending/in-progress follow-up(s).`,
      evidence: { openFollowUps: beh.openFollowUps },
    });
  }

  // --- Participation / achievements ---
  if (part.awardCount >= t.participationStrengthAwards) {
    strengths.push({
      code: "participation.awards",
      category: "strength",
      severity: "info",
      title: "Event achievements",
      detail: `${part.awardCount} award(s) across ${part.eventCount} event participation(s).`,
      evidence: { awardCount: part.awardCount, eventCount: part.eventCount },
    });
  }
  if (aggregates.achievements.length >= 2) {
    strengths.push({
      code: "achievements.multiple",
      category: "strength",
      severity: "info",
      title: "Multiple achievements",
      detail: `${aggregates.achievements.length} recorded achievements.`,
      evidence: { count: aggregates.achievements.length },
    });
  }

  return { strengths, weaknesses, risks };
}

export function validateGenerateInput(input: {
  studentProfileId?: string;
  academicYearId?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.studentProfileId?.trim()) {
    errors.studentProfileId = "Student is required.";
  }
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  return errors;
}
