import type { PermissionKey } from "@/lib/authz/catalog";

export type TeacherPortalNavItem = {
  id: string;
  label: string;
  href: string;
  permission: PermissionKey | PermissionKey[];
};

/** Subnav for Teacher Portal — hide items the actor cannot use. */
export const TEACHER_PORTAL_NAV: TeacherPortalNavItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/dashboard/teacher",
    permission: "workforce.workspace.read",
  },
  {
    id: "attendance",
    label: "Attendance",
    href: "/dashboard/teacher/attendance",
    permission: "attendance.record.create",
  },
  {
    id: "marks",
    label: "Marks",
    href: "/dashboard/teacher/marks",
    permission: "assessment.results.enter",
  },
  {
    id: "homework",
    label: "Homework",
    href: "/dashboard/teacher/homework",
    permission: ["homework.read", "homework.assign"],
  },
  {
    id: "behaviour",
    label: "Behaviour",
    href: "/dashboard/teacher/behaviour",
    permission: "conduct.incident.record",
  },
  {
    id: "events",
    label: "Events",
    href: "/dashboard/teacher/events",
    permission: "engagement.event.read",
  },
  {
    id: "announcements",
    label: "Announcements",
    href: "/dashboard/teacher/announcements",
    permission: "communication.message.read",
  },
  {
    id: "resources",
    label: "Resources",
    href: "/dashboard/teacher/resources",
    permission: "workforce.department.read",
  },
  {
    id: "department",
    label: "Department",
    href: "/dashboard/teacher/department",
    permission: "workforce.department.read",
  },
  {
    id: "profile",
    label: "Profile",
    href: "/dashboard/teacher/profile",
    permission: "identity.person.read",
  },
];

export const TEACHER_PORTAL_AREAS = TEACHER_PORTAL_NAV.map((n) => n.id);
