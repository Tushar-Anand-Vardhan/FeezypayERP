import type { PermissionKey } from "@/lib/authz/catalog";

export type ParentPortalNavItem = {
  id: string;
  label: string;
  href: string;
  permission: PermissionKey | PermissionKey[];
};

/** Parent F10 — RO views of linked children (mirrors student portal areas). */
export const PARENT_PORTAL_NAV: ParentPortalNavItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/dashboard/parent",
    permission: "enrollment.admission.read",
  },
  {
    id: "attendance",
    label: "Attendance",
    href: "/dashboard/parent/attendance",
    permission: "attendance.record.read",
  },
  {
    id: "assessments",
    label: "Assessments",
    href: "/dashboard/parent/assessments",
    permission: "assessment.results.read",
  },
  {
    id: "report-cards",
    label: "Report cards",
    href: "/dashboard/parent/report-cards",
    permission: "document.report_card.read",
  },
  {
    id: "homework",
    label: "Homework",
    href: "/dashboard/parent/homework",
    permission: "homework.read",
  },
  {
    id: "announcements",
    label: "Announcements",
    href: "/dashboard/parent/announcements",
    permission: "communication.message.read",
  },
  {
    id: "behaviour",
    label: "Behaviour",
    href: "/dashboard/parent/behaviour",
    permission: "conduct.incident.read",
  },
];

export const PARENT_PORTAL_AREAS = PARENT_PORTAL_NAV.map((n) => n.id);
