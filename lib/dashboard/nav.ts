import {
  canAnyInBootstrap,
  type AuthzBootstrap,
} from "@/lib/authz/bootstrap-shared";
import type { PermissionKey } from "@/lib/authz/catalog";

export type DashboardNavItem = {
  id: string;
  label: string;
  href: string;
  permission: PermissionKey | PermissionKey[];
  /** Placeholder until onboarding is complete (then still a stub href). */
  lockedUntilOnboarding?: boolean;
};

export type DashboardNavGroup = {
  id: string;
  label: string;
  items: DashboardNavItem[];
};

export const DASHBOARD_NAV_GROUPS: DashboardNavGroup[] = [
  {
    id: "home",
    label: "Home",
    items: [
      {
        id: "overview",
        label: "Overview",
        href: "/dashboard",
        permission: "tenant.school.read",
      },
    ],
  },
  {
    id: "portals",
    label: "Portals",
    items: [
      {
        id: "principal",
        label: "Principal",
        href: "/dashboard/principal",
        permission: "analytics.dashboard.read",
      },
      {
        id: "teacher",
        label: "Teacher",
        href: "/dashboard/teacher",
        permission: "workforce.workspace.read",
      },
      {
        id: "student",
        label: "Student",
        href: "/dashboard/student",
        permission: "enrollment.admission.read",
      },
      {
        id: "parent",
        label: "Parent",
        href: "/dashboard/parent",
        permission: "enrollment.admission.read",
      },
    ],
  },
  {
    id: "configuration",
    label: "Configuration",
    items: [
      {
        id: "configuration",
        label: "Configuration",
        href: "/dashboard/configuration",
        permission: "config.catalog.read",
      },
      {
        id: "calendar",
        label: "Calendar",
        href: "/dashboard/calendar",
        permission: "calendar.year.read",
      },
      {
        id: "houses-clubs",
        label: "Houses & clubs",
        href: "/dashboard/houses-clubs",
        permission: "config.catalog.read",
      },
      {
        id: "subjects",
        label: "Subjects",
        href: "/dashboard/subjects",
        permission: "config.catalog.read",
      },
      {
        id: "grading-scales",
        label: "Grading scales",
        href: "/dashboard/grading-scales",
        permission: "config.catalog.read",
      },
      {
        id: "departments",
        label: "Departments",
        href: "/dashboard/departments",
        permission: "workforce.department.read",
      },
      {
        id: "timetable",
        label: "Timetable",
        href: "/dashboard/timetable",
        permission: "timetable.grid.read",
      },
    ],
  },
  {
    id: "academics",
    label: "Academics",
    items: [
      {
        id: "assessments",
        label: "Assessments",
        href: "/dashboard/assessments",
        permission: "assessment.config.read",
      },
      {
        id: "report-cards",
        label: "Report cards",
        href: "/dashboard/report-cards",
        permission: "document.template.edit",
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        id: "notifications",
        label: "Notifications",
        href: "/dashboard/notifications",
        permission: "communication.message.read",
      },
      {
        id: "students",
        label: "Students",
        href: "#",
        permission: "enrollment.admission.read",
        lockedUntilOnboarding: true,
      },
      {
        id: "attendance",
        label: "Attendance",
        href: "#",
        permission: "attendance.record.read",
        lockedUntilOnboarding: true,
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        id: "platform",
        label: "Platform",
        href: "/dashboard/platform",
        permission: "platform.tenant.read",
      },
      {
        id: "settings",
        label: "Settings",
        href: "/dashboard/settings",
        // Reachable during onboarding (reset) and after go-live.
        permission: ["tenant.school.edit", "onboarding.wizard.edit"],
      },
    ],
  },
];

export function isDashboardNavActive(href: string, pathname: string): boolean {
  if (!href || href === "#") return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeDashboardNavGroupId(pathname: string): string | null {
  for (const group of DASHBOARD_NAV_GROUPS) {
    if (group.items.some((item) => isDashboardNavActive(item.href, pathname))) {
      return group.id;
    }
  }
  return null;
}

export function visibleDashboardNavGroups(
  authz: AuthzBootstrap | null | undefined,
): DashboardNavGroup[] {
  return DASHBOARD_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      canAnyInBootstrap(authz, item.permission),
    ),
  })).filter((group) => group.items.length > 0);
}
