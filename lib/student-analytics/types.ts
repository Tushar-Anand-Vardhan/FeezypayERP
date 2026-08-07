/** Student Analytics Engine (E22 student slice) — types. */

export type StudentAnalyticsActionResult =
  | {
      success: true;
      message: string;
      id?: string;
      report?: StudentAnalyticsReport;
    }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type InsightSeverity = "info" | "low" | "medium" | "high";

export type DeterministicInsight = {
  code: string;
  category: "strength" | "weakness" | "risk";
  severity: InsightSeverity;
  title: string;
  detail: string;
  /** Machine-readable evidence used by the rule */
  evidence: Record<string, unknown>;
};

export type ProgressPoint = {
  key: string;
  label: string;
  value: number | null;
  meta?: Record<string, unknown>;
};

export type SubjectTrend = {
  subjectId: string;
  subjectName: string | null;
  averagePercent: number | null;
  resultCount: number;
  trendDelta: number | null;
  points: ProgressPoint[];
};

export type AttendanceAggregate = {
  total: number;
  byStatus: Record<string, number>;
  presentRate: number | null;
  absentRate: number | null;
  lateCount: number;
  monthly: ProgressPoint[];
};

export type AssessmentAggregate = {
  totalResults: number;
  publishedCount: number;
  absentCount: number;
  overallAveragePercent: number | null;
  passRate: number | null;
  bySubject: SubjectTrend[];
  byExam: ProgressPoint[];
};

export type ParticipationAggregate = {
  eventCount: number;
  attendedCount: number;
  awardCount: number;
  roles: Record<string, number>;
};

export type BehaviourAggregate = {
  total: number;
  byKind: Record<string, number>;
  bySeverity: Record<string, number>;
  positiveCount: number;
  disciplinaryCount: number;
  openFollowUps: number;
};

export type AchievementItem = {
  source: "event_award" | "conduct_commendation" | "assessment_high";
  title: string;
  occurredOn: string | null;
  refId: string;
};

export type TeacherRemarkItem = {
  source: "assessment" | "behaviour" | "homework";
  title: string;
  body: string | null;
  occurredOn: string | null;
  refId: string;
  visibility: string | null;
};

export type StudentAnalyticsAggregates = {
  attendance: AttendanceAggregate;
  assessment: AssessmentAggregate;
  subjectTrends: SubjectTrend[];
  participation: ParticipationAggregate;
  behaviour: BehaviourAggregate;
  achievements: AchievementItem[];
  teacherRemarks: TeacherRemarkItem[];
};

export type StudentAnalyticsInsights = {
  strengths: DeterministicInsight[];
  weaknesses: DeterministicInsight[];
  risks: DeterministicInsight[];
};

export type StudentAnalyticsProgressGraphs = {
  attendanceByMonth: ProgressPoint[];
  assessmentByExam: ProgressPoint[];
  subjectTrends: SubjectTrend[];
};

export type StudentAnalyticsReport = {
  studentProfileId: string;
  academicYearId: string;
  generatedAt: string;
  generatorVersion: string;
  aggregates: StudentAnalyticsAggregates;
  insights: StudentAnalyticsInsights;
  progressGraphs: StudentAnalyticsProgressGraphs;
  sourceCounts: Record<string, number>;
};

export type GenerateStudentAnalyticsInput = {
  studentProfileId: string;
  academicYearId: string;
  /** Persist snapshot to E22 mart */
  persistSnapshot?: boolean;
  /** Parent/student: only use published/visible source rows */
  visibleOnly?: boolean;
};

/** Documented rule thresholds — deterministic, no AI. */
export const ANALYTICS_THRESHOLDS = {
  attendanceStrengthRate: 0.95,
  attendanceWatchRate: 0.85,
  attendanceRiskRate: 0.75,
  subjectStrengthPercent: 75,
  subjectWeakPercent: 50,
  subjectRiskPercent: 40,
  passPercent: 33,
  disciplinaryRiskCount: 2,
  highSeverityRiskCount: 1,
  participationStrengthAwards: 1,
  lateAttendanceWatch: 5,
} as const;

export const GENERATOR_VERSION = "1.0.0";
