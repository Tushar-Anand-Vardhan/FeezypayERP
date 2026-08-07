import type {
  AiShortcutPlaceholder,
  TeacherWorkspacePanelDefinition,
} from "@/lib/teacher-workspace/types";

export const TEACHER_WORKSPACE_PANELS: TeacherWorkspacePanelDefinition[] = [
  {
    id: "todays_timetable",
    name: "Today's timetable",
    description: "Periods scheduled for this teacher today.",
    sourceTables: ["timetable_slots", "period_definitions", "sections", "subjects"],
  },
  {
    id: "pending_attendance",
    name: "Pending attendance",
    description: "Sections on today's grid with no attendance rows yet.",
    sourceTables: ["timetable_slots", "attendance_records"],
  },
  {
    id: "pending_assessments",
    name: "Pending assessments",
    description: "Published exam schedules for taught subjects without results.",
    sourceTables: [
      "exam_definitions",
      "exam_subject_schedules",
      "exam_results",
      "employment_subjects",
    ],
  },
  {
    id: "homework",
    name: "Homework",
    description: "Open homework assignments for this employment.",
    sourceTables: ["homework_assignments"],
  },
  {
    id: "announcements",
    name: "Announcements",
    description: "Published staff/school department announcements.",
    sourceTables: ["department_announcements", "departments"],
  },
  {
    id: "upcoming_events",
    name: "Upcoming events",
    description: "Approved calendar events for the active year.",
    sourceTables: ["calendar_events", "academic_years"],
  },
  {
    id: "class_reminders",
    name: "Class reminders",
    description: "Remaining periods today plus near-term events.",
    sourceTables: ["timetable_slots", "period_definitions", "calendar_events"],
  },
  {
    id: "department_notices",
    name: "Department notices",
    description: "Published department-visibility notices for memberships.",
    sourceTables: ["department_announcements", "department_memberships"],
  },
  {
    id: "ai_shortcuts",
    name: "AI shortcuts",
    description: "Placeholder E23 services (propose only).",
    sourceTables: [],
  },
];

/** Catalogue only — no school-specific copy. */
export const TEACHER_AI_SHORTCUT_PLACEHOLDERS: AiShortcutPlaceholder[] = [
  {
    serviceId: "ai.draft.lesson_plan",
    label: "Draft lesson plan",
    status: "placeholder",
  },
  {
    serviceId: "ai.draft.communication",
    label: "Draft parent message",
    status: "placeholder",
  },
  {
    serviceId: "ai.draft.report_narrative",
    label: "Draft report remarks",
    status: "placeholder",
  },
  {
    serviceId: "ai.insight.attendance_risk",
    label: "Attendance risk (my sections)",
    status: "placeholder",
  },
  {
    serviceId: "ai.chat.assistant",
    label: "Ask assistant",
    status: "placeholder",
  },
];

/** Convert JS Date to ISO date (local calendar day). */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Schema day_of_week: 1=Monday … 7=Sunday. */
export function dayOfWeekFromDate(d: Date): number {
  const js = d.getDay(); // 0=Sun
  return js === 0 ? 7 : js;
}

export function parseAsOfDate(input?: string | null): Date {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}
