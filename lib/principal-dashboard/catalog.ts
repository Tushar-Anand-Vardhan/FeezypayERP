import type { PrincipalPanelDefinition } from "@/lib/principal-dashboard/types";

export const PRINCIPAL_DASHBOARD_PANELS: PrincipalPanelDefinition[] = [
  {
    id: "school_attendance",
    name: "School attendance",
    description: "Student presence rates and today’s section coverage.",
    sourceTables: ["attendance_records", "attendance_sessions"],
    workflowIds: ["WF-PRI-01", "WF-ADM-08"],
  },
  {
    id: "teacher_attendance",
    name: "Teacher attendance",
    description:
      "Teacher attendance-marking completion (staff biometric attendance FUTURE).",
    sourceTables: ["attendance_sessions", "teacher_employments", "timetable_slots"],
    workflowIds: ["WF-PRI-01", "WF-TCH-01"],
  },
  {
    id: "student_performance",
    name: "Student performance",
    description: "School-wide published assessment averages.",
    sourceTables: ["exam_results", "subjects"],
    workflowIds: ["WF-PRI-01", "WF-PRI-08"],
  },
  {
    id: "department_performance",
    name: "Department performance",
    description: "Per-department member/subject counts and subject mark averages.",
    sourceTables: [
      "departments",
      "department_memberships",
      "department_subjects",
      "exam_results",
    ],
    workflowIds: ["WF-PRI-05"],
  },
  {
    id: "upcoming_events",
    name: "Upcoming events",
    description: "Approved/published calendar events ahead.",
    sourceTables: ["calendar_events"],
    workflowIds: ["WF-PRI-07"],
  },
  {
    id: "pending_approvals",
    name: "Pending approvals",
    description: "Events, leave, conduct, and draft mark sessions needing attention.",
    sourceTables: [
      "calendar_events",
      "attendance_leave_requests",
      "conduct_incidents",
      "assessment_mark_sessions",
    ],
    workflowIds: ["WF-PRI-02", "WF-PRI-06", "WF-PRI-08"],
  },
  {
    id: "pending_report_cards",
    name: "Pending report cards",
    description: "Draft report card issues awaiting issue.",
    sourceTables: ["report_card_issues"],
    workflowIds: ["WF-PRI-09"],
  },
  {
    id: "pending_assessments",
    name: "Pending assessments",
    description: "Draft mark sessions and published exams still missing results.",
    sourceTables: ["assessment_mark_sessions", "exam_definitions", "exam_results"],
    workflowIds: ["WF-PRI-08"],
  },
  {
    id: "notifications",
    name: "Notifications",
    description: "Recent notification delivery history for the school.",
    sourceTables: ["notification_delivery_requests"],
    workflowIds: ["WF-PRI-01", "WF-SYS-04"],
  },
  {
    id: "school_health",
    name: "School health indicators",
    description: "Deterministic composite health from live ops metrics.",
    sourceTables: [
      "attendance_records",
      "exam_results",
      "conduct_incidents",
      "assessment_mark_sessions",
      "report_card_issues",
    ],
    workflowIds: ["WF-PRI-01", "WF-VP-01"],
  },
];

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseAsOfDate(value?: string | null): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T12:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function dayOfWeekFromDate(d: Date): number {
  // JS: 0=Sun … 6=Sat → ISO-ish 1=Mon … 7=Sun used by timetable
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}
