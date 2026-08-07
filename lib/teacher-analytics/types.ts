/** Teacher Analytics Engine (E22 teacher slice) — types. */

export type TeacherAnalyticsActionResult =
  | {
      success: true;
      message: string;
      id?: string;
      report?: TeacherAnalyticsReport;
    }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type InsightSeverity = "info" | "low" | "medium" | "high";

export type DeterministicInsight = {
  code: string;
  category: "strength" | "weakness" | "risk";
  severity: InsightSeverity;
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
};

export type ProgressPoint = {
  key: string;
  label: string;
  value: number | null;
  meta?: Record<string, unknown>;
};

export type AttendanceCompletionAggregate = {
  taughtSectionCount: number;
  sessionsExpected: number;
  sessionsCompletedByTeacher: number;
  sessionsCompletedOnSections: number;
  completionRateByTeacher: number | null;
  sectionCoverageRate: number | null;
  byWorkflow: Record<string, number>;
};

export type AssessmentCompletionAggregate = {
  markSessionsTotal: number;
  markSessionsPublishedOrLocked: number;
  markSessionsDraft: number;
  completionRate: number | null;
  resultsEntered: number;
  teacherCreatedAssessments: number;
};

export type HomeworkCompletionAggregate = {
  assignedTotal: number;
  assignedOpen: number;
  assignedClosed: number;
  submissionsTotal: number;
  submissionsGraded: number;
  gradingRate: number | null;
};

export type StudentPerformanceAggregate = {
  resultCount: number;
  averagePercent: number | null;
  passRate: number | null;
  bySubject: Array<{
    subjectId: string;
    subjectName: string | null;
    averagePercent: number | null;
    resultCount: number;
  }>;
};

export type WorkloadAggregate = {
  weeklyPeriods: number;
  uniqueSections: number;
  uniqueSubjects: number;
  openHomework: number;
  draftMarkSessions: number;
  workloadScore: number;
};

export type ClassesTaughtAggregate = {
  sectionIds: string[];
  classIds: string[];
  subjectIds: string[];
  sectionCount: number;
  classCount: number;
  subjectCount: number;
  slots: Array<{
    sectionId: string;
    subjectId: string | null;
    dayOfWeek: number;
    periodDefinitionId: string;
  }>;
};

export type DepartmentContributionAggregate = {
  memberships: Array<{
    departmentId: string;
    departmentName: string | null;
    role: string;
  }>;
  teachingAssignments: number;
  isHod: boolean;
  departmentIds: string[];
};

export type TeacherAnalyticsAggregates = {
  attendanceCompletion: AttendanceCompletionAggregate;
  assessmentCompletion: AssessmentCompletionAggregate;
  homeworkCompletion: HomeworkCompletionAggregate;
  averageStudentPerformance: StudentPerformanceAggregate;
  workload: WorkloadAggregate;
  classesTaught: ClassesTaughtAggregate;
  departmentContribution: DepartmentContributionAggregate;
  /** Placeholder for E23 — always not_built in v1 */
  aiInsights: {
    status: "not_built";
    note: string;
  };
};

export type TeacherAnalyticsInsights = {
  strengths: DeterministicInsight[];
  weaknesses: DeterministicInsight[];
  risks: DeterministicInsight[];
};

export type TeacherAnalyticsProgressGraphs = {
  attendanceCompletion: ProgressPoint[];
  assessmentCompletion: ProgressPoint[];
  homeworkGrading: ProgressPoint[];
  studentPerformanceBySubject: ProgressPoint[];
};

export type TeacherAnalyticsReport = {
  employmentId: string;
  academicYearId: string;
  generatedAt: string;
  generatorVersion: string;
  aggregates: TeacherAnalyticsAggregates;
  insights: TeacherAnalyticsInsights;
  progressGraphs: TeacherAnalyticsProgressGraphs;
  sourceCounts: Record<string, number>;
};

export type GenerateTeacherAnalyticsInput = {
  employmentId: string;
  academicYearId: string;
  persistSnapshot?: boolean;
};

export const TEACHER_ANALYTICS_THRESHOLDS = {
  attendanceCompletionStrength: 0.9,
  attendanceCompletionWatch: 0.7,
  attendanceCompletionRisk: 0.5,
  assessmentCompletionStrength: 0.85,
  assessmentCompletionWatch: 0.6,
  assessmentCompletionRisk: 0.4,
  homeworkGradingStrength: 0.8,
  homeworkGradingWatch: 0.5,
  studentPerformanceStrength: 70,
  studentPerformanceWatch: 50,
  studentPerformanceRisk: 40,
  highWorkloadPeriods: 30,
  highOpenHomework: 8,
} as const;

export const TEACHER_GENERATOR_VERSION = "1.0.0";
