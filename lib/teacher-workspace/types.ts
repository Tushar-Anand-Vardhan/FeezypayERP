/** Teacher Workspace — homepage aggregate types. */

export type TeacherWorkspacePanelId =
  | "todays_timetable"
  | "pending_attendance"
  | "pending_assessments"
  | "homework"
  | "announcements"
  | "upcoming_events"
  | "class_reminders"
  | "department_notices"
  | "ai_shortcuts";

export type TeacherWorkspacePanelDefinition = {
  id: TeacherWorkspacePanelId;
  name: string;
  description: string;
  sourceTables: string[];
};

export type AiShortcutPlaceholder = {
  serviceId: string;
  label: string;
  status: "placeholder";
};

export type TimetablePeriodRow = {
  slotId: string;
  dayOfWeek: number;
  periodDefinitionId: string;
  periodNumber: number | null;
  startTime: string | null;
  endTime: string | null;
  sectionId: string;
  sectionName: string | null;
  className: string | null;
  subjectId: string | null;
  subjectName: string | null;
  roomId: string | null;
};

export type PendingAttendanceRow = {
  sectionId: string;
  sectionName: string | null;
  className: string | null;
  attendanceDate: string;
  reason: string;
};

export type PendingAssessmentRow = {
  examDefinitionId: string;
  examName: string;
  subjectId: string;
  subjectName: string | null;
  classId: string;
  className: string | null;
  scheduleId: string;
  publishingStatus: string;
};

export type HomeworkRow = {
  id: string;
  title: string;
  sectionId: string;
  subjectId: string | null;
  assignedOn: string;
  dueOn: string | null;
  status: string;
};

export type AnnouncementRow = {
  id: string;
  departmentId: string;
  departmentName: string | null;
  title: string;
  body: string;
  visibility: string;
  publishedAt: string | null;
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

export type ClassReminderRow = {
  kind: "period" | "event";
  id: string;
  title: string;
  whenLabel: string;
  sectionId?: string | null;
  startsAt?: string | null;
};

export type TeacherWorkspaceEmployment = {
  employmentId: string;
  teacherProfileId: string;
  personId: string;
  fullName: string;
  designation: string | null;
  departmentId: string | null;
  isHod: boolean;
  status: string;
};

export type TeacherWorkspacePanel<T = unknown> = {
  id: TeacherWorkspacePanelId;
  name: string;
  description: string;
  sourceTables: string[];
  empty: boolean;
  items: T;
};

export type TeacherWorkspaceAggregate = {
  schoolId: string;
  employmentId: string;
  asOfDate: string;
  dayOfWeek: number;
  employment: TeacherWorkspaceEmployment;
  generatedAt: string;
  panels: Record<TeacherWorkspacePanelId, TeacherWorkspacePanel>;
};
