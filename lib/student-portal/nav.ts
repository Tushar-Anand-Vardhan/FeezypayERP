import type { PermissionKey } from "@/lib/authz/catalog";

export type StudentPortalNavItem = {
  id: string;
  label: string;
  href: string;
  permission: PermissionKey | PermissionKey[];
};

/** Subnav for Student Portal — hide items the actor cannot use. */
export const STUDENT_PORTAL_NAV: StudentPortalNavItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/dashboard/student",
    permission: "enrollment.admission.read",
  },
  {
    id: "attendance",
    label: "Attendance",
    href: "/dashboard/student/attendance",
    permission: "attendance.record.read",
  },
  {
    id: "homework",
    label: "Homework",
    href: "/dashboard/student/homework",
    permission: "homework.read",
  },
  {
    id: "assessments",
    label: "Assessments",
    href: "/dashboard/student/assessments",
    permission: "assessment.results.read",
  },
  {
    id: "report-cards",
    label: "Report cards",
    href: "/dashboard/student/report-cards",
    permission: "document.report_card.read",
  },
  {
    id: "announcements",
    label: "Announcements",
    href: "/dashboard/student/announcements",
    permission: "communication.message.read",
  },
  {
    id: "events",
    label: "Events",
    href: "/dashboard/student/events",
    permission: "engagement.event.read",
  },
  {
    id: "achievements",
    label: "Achievements",
    href: "/dashboard/student/achievements",
    permission: "enrollment.admission.read",
  },
  {
    id: "behaviour",
    label: "Behaviour",
    href: "/dashboard/student/behaviour",
    permission: "conduct.incident.read",
  },
  {
    id: "profile",
    label: "Profile",
    href: "/dashboard/student/profile",
    permission: "identity.person.read",
  },
  {
    id: "documents",
    label: "Documents",
    href: "/dashboard/student/documents",
    permission: "enrollment.admission.read",
  },
  {
    id: "ai",
    label: "AI",
    href: "/dashboard/student/ai",
    permission: "enrollment.admission.read",
  },
];

export const STUDENT_PORTAL_AREAS = STUDENT_PORTAL_NAV.map((n) => n.id);
