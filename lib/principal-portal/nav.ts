import type { PermissionKey } from "@/lib/authz/catalog";

export type PrincipalPortalNavItem = {
  id: string;
  label: string;
  href: string;
  permission: PermissionKey | PermissionKey[];
};

/** Subnav for Principal portal — Wave 2 ops + dashboard. */
export const PRINCIPAL_PORTAL_NAV: PrincipalPortalNavItem[] = [
  {
    id: "home",
    label: "Overview",
    href: "/dashboard/principal",
    permission: "analytics.dashboard.read",
  },
  {
    id: "teachers",
    label: "Teachers",
    href: "/dashboard/principal/teachers",
    permission: "workforce.employment.read",
  },
  {
    id: "students",
    label: "Students",
    href: "/dashboard/principal/students",
    permission: "enrollment.admission.read",
  },
  {
    id: "enroll",
    label: "Enroll",
    href: "/dashboard/principal/enroll",
    permission: ["enrollment.placement.edit", "enrollment.admission.read"],
  },
  {
    id: "promote",
    label: "Promote",
    href: "/dashboard/principal/promote",
    permission: "enrollment.placement.edit",
  },
];

export const PRINCIPAL_PORTAL_AREAS = PRINCIPAL_PORTAL_NAV.map((n) => n.id);

export const PRINCIPAL_PORTAL_PERMISSIONS = [
  "analytics.dashboard.read",
  "workforce.employment.read",
  "workforce.employment.edit",
  "workforce.employment.archive",
  "enrollment.admission.read",
  "enrollment.admission.edit",
  "enrollment.placement.edit",
  "structure.class.read",
  "timetable.grid.read",
  "config.catalog.read",
] as const satisfies readonly PermissionKey[];
