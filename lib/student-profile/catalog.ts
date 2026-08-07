import type { StudentProfileModuleDefinition } from "@/lib/student-profile/types";

/** Separate profile modules — each maps to owning engine(s), never a dump column. */
export const STUDENT_PROFILE_MODULES: StudentProfileModuleDefinition[] = [
  {
    id: "personal",
    name: "Personal information",
    ownerEngine: "E04",
    description: "Lifelong person + student profile identity.",
  },
  {
    id: "admission",
    name: "Admission",
    ownerEngine: "E06",
    description: "School membership: number, status, dates.",
  },
  {
    id: "academic_history",
    name: "Academic history",
    ownerEngine: "E06",
    description: "Year placements across classes/sections.",
  },
  {
    id: "attendance",
    name: "Attendance",
    ownerEngine: "E12",
    description: "Presence facts from E12 (backend live; marking UI later).",
  },
  {
    id: "assessments",
    name: "Assessments",
    ownerEngine: "E11",
    description: "Class schedules + exam results (E11 ops backend live; marks UI later).",
  },
  {
    id: "report_cards",
    name: "Report cards",
    ownerEngine: "E20",
    description: "Templates + issued report cards (E20 issue backend; PDF later).",
  },
  {
    id: "events",
    name: "Events",
    ownerEngine: "E17",
    description: "Calendar occasions + participation (E17; by reference).",
  },
  {
    id: "competitions",
    name: "Competitions",
    ownerEngine: "E17",
    description: "Competition entries linked to calendar events.",
  },
  {
    id: "achievements",
    name: "Achievements",
    ownerEngine: "E35",
    description:
      "Permanent achievement profile from calendar activities + manual awards (E35).",
  },
  {
    id: "behaviour",
    name: "Behaviour",
    ownerEngine: "E13",
    description: "Timestamped behaviour remarks (E13).",
  },
  {
    id: "medical",
    name: "Medical records",
    ownerEngine: "E14",
    description: "Lifelong attrs + medical incidents.",
  },
  {
    id: "documents",
    name: "Documents",
    ownerEngine: "E20",
    description: "Issued student documents.",
  },
  {
    id: "parents",
    name: "Parent information",
    ownerEngine: "E04/E06",
    description: "Linked guardians.",
  },
  {
    id: "transport",
    name: "Transport",
    ownerEngine: "Transport satellite",
    description: "Route / stop assignments.",
  },
  {
    id: "house",
    name: "House",
    ownerEngine: "E07",
    description: "House memberships (SoT over admission.house_id).",
  },
  {
    id: "club_membership",
    name: "Club membership",
    ownerEngine: "E07",
    description: "Club memberships.",
  },
  {
    id: "ai_summary",
    name: "Future AI summary",
    ownerEngine: "E23",
    description: "Placeholder for assistive narrative over modules.",
  },
];
