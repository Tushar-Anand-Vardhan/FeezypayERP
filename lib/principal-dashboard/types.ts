/** Principal Dashboard — school ops homepage aggregate types. */

export type PrincipalPanelId =
  | "school_attendance"
  | "teacher_attendance"
  | "student_performance"
  | "department_performance"
  | "upcoming_events"
  | "pending_approvals"
  | "pending_report_cards"
  | "pending_assessments"
  | "notifications"
  | "school_health";

export type PrincipalPanelDefinition = {
  id: PrincipalPanelId;
  name: string;
  description: string;
  sourceTables: string[];
  workflowIds: string[];
};

export type PrincipalPanel<T> = {
  id: PrincipalPanelId;
  name: string;
  description: string;
  sourceTables: string[];
  empty: boolean;
  items: T;
};

export type SchoolAttendanceSummary = {
  asOfDate: string;
  academicYearId: string | null;
  totalRecords: number;
  byStatus: Record<string, number>;
  presentRate: number | null;
  sectionsWithSessionsToday: number;
  sectionsMissingToday: number;
};

/** Proxy until staff attendance OLTP exists — marking completion by teachers. */
export type TeacherAttendanceSummary = {
  asOfDate: string;
  note: string;
  activeEmployments: number;
  teachersWhoMarkedToday: number;
  expectedSectionsToday: number;
  sectionsMarkedToday: number;
  markingCompletionRate: number | null;
};

export type StudentPerformanceSummary = {
  academicYearId: string | null;
  publishedResultCount: number;
  averagePercent: number | null;
  passRate: number | null;
  bySubjectTop: Array<{
    subjectId: string;
    subjectName: string | null;
    averagePercent: number | null;
    resultCount: number;
  }>;
};

export type DepartmentPerformanceRow = {
  departmentId: string;
  departmentName: string;
  memberCount: number;
  subjectCount: number;
  averagePercent: number | null;
  resultCount: number;
};

export type UpcomingEventRow = {
  id: string;
  title: string;
  category: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  approvalStatus: string;
};

export type PendingApprovalRow = {
  kind:
    | "calendar_event"
    | "leave_request"
    | "conduct_incident"
    | "mark_session";
  id: string;
  title: string;
  status: string;
  createdAt: string | null;
  hrefHint: string;
};

export type PendingReportCardRow = {
  id: string;
  title: string;
  status: string;
  studentProfileId: string;
  academicYearId: string;
  updatedAt: string;
};

export type PendingAssessmentRow = {
  kind: "mark_session_draft" | "exam_awaiting_results";
  id: string;
  title: string;
  status: string;
  subjectId: string | null;
  sectionId: string | null;
};

export type NotificationRow = {
  id: string;
  title: string;
  channel: string;
  status: string;
  notificationTypeCode: string;
  createdAt: string;
  readAt: string | null;
};

export type SchoolHealthIndicator = {
  code: string;
  label: string;
  status: "healthy" | "watch" | "critical" | "unknown";
  value: number | null;
  detail: string;
  evidence: Record<string, unknown>;
};

export type SchoolHealthSummary = {
  overall: "healthy" | "watch" | "critical" | "unknown";
  indicators: SchoolHealthIndicator[];
};

export type PrincipalDashboardAggregate = {
  schoolId: string;
  schoolName: string | null;
  asOfDate: string;
  academicYearId: string | null;
  generatedAt: string;
  panels: {
    school_attendance: PrincipalPanel<SchoolAttendanceSummary>;
    teacher_attendance: PrincipalPanel<TeacherAttendanceSummary>;
    student_performance: PrincipalPanel<StudentPerformanceSummary>;
    department_performance: PrincipalPanel<DepartmentPerformanceRow[]>;
    upcoming_events: PrincipalPanel<UpcomingEventRow[]>;
    pending_approvals: PrincipalPanel<PendingApprovalRow[]>;
    pending_report_cards: PrincipalPanel<PendingReportCardRow[]>;
    pending_assessments: PrincipalPanel<PendingAssessmentRow[]>;
    notifications: PrincipalPanel<NotificationRow[]>;
    school_health: PrincipalPanel<SchoolHealthSummary>;
  };
};

export type PrincipalDashboardActionResult =
  | { success: true; dashboard: PrincipalDashboardAggregate }
  | { success: false; error: string };
