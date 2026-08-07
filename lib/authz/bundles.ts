import {
  PERMISSION_KEYS,
  type PermissionKey,
} from "@/lib/authz/catalog";

export const SYSTEM_ROLE_CODES = [
  "school_admin",
  "principal",
  "vice_principal",
  "hod",
  "teacher",
  "student",
  "parent",
  "staff",
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

/** Display / grant hierarchy (higher index = lower privilege for grant rules). */
export const ROLE_HIERARCHY: SystemRoleCode[] = [
  "school_admin",
  "principal",
  "vice_principal",
  "hod",
  "teacher",
  "staff",
  "student",
  "parent",
];

const ALL = [...PERMISSION_KEYS] as PermissionKey[];

function except(keys: PermissionKey[], drop: PermissionKey[]): PermissionKey[] {
  const ban = new Set(drop);
  return keys.filter((k) => !ban.has(k));
}

/** System persona → permission keys (seed mirror). */
export const SYSTEM_ROLE_BUNDLES: Record<SystemRoleCode, PermissionKey[]> = {
  school_admin: ALL,
  principal: except(ALL, [
    "tenant.school.archive",
    "authz.role.create_custom",
  ]),
  vice_principal: except(ALL, [
    "tenant.school.archive",
    "tenant.school.edit",
    "calendar.year.lock",
    "calendar.year.unlock",
    "authz.role.create_custom",
    "authz.role.grant",
    "authz.role.revoke",
    "assessment.results.unlock",
  ]),
  hod: [
    "tenant.school.read",
    "access.session.read",
    "identity.person.read",
    "identity.person.edit",
    "workforce.employment.read",
    "workforce.employment.edit",
    "workforce.workspace.read",
    "workforce.department.read",
    "workforce.department.edit",
    "enrollment.admission.read",
    "config.catalog.read",
    "calendar.year.read",
    "calendar.event.read",
    "structure.class.read",
    "timetable.grid.read",
    "timetable.grid.edit",
    "assessment.config.read",
    "assessment.results.read",
    "assessment.results.enter",
    "assessment.results.publish",
    "assessment.results.lock",
    "attendance.record.read",
    "attendance.record.create",
    "attendance.session.approve",
    "conduct.incident.read",
    "conduct.incident.record",
    "conduct.incident.approve",
    "homework.assign",
    "homework.grade",
    "homework.read",
    "engagement.event.read",
    "communication.message.read",
    "communication.message.publish",
    "document.report_card.read",
    "analytics.dashboard.read",
  ],
  teacher: [
    "tenant.school.read",
    "access.session.read",
    "identity.person.read",
    "identity.person.edit",
    "workforce.employment.read",
    "workforce.workspace.read",
    "workforce.department.read",
    "enrollment.admission.read",
    "config.catalog.read",
    "calendar.year.read",
    "calendar.event.read",
    "structure.class.read",
    "timetable.grid.read",
    "assessment.config.read",
    "assessment.results.read",
    "assessment.results.enter",
    "attendance.record.read",
    "attendance.record.create",
    "conduct.incident.read",
    "conduct.incident.record",
    "homework.assign",
    "homework.grade",
    "homework.read",
    "engagement.event.read",
    "communication.message.read",
    "document.report_card.read",
    "analytics.dashboard.read",
  ],
  staff: [
    "tenant.school.read",
    "access.session.read",
    "identity.person.read",
    "identity.person.edit",
    "workforce.employment.read",
    "workforce.workspace.read",
    "config.catalog.read",
    "calendar.year.read",
    "calendar.event.read",
    "communication.message.read",
  ],
  student: [
    "tenant.school.read",
    "access.session.read",
    "identity.person.read",
    "identity.person.edit",
    "enrollment.admission.read",
    "calendar.year.read",
    "calendar.event.read",
    "timetable.grid.read",
    "assessment.results.read",
    "attendance.record.read",
    "homework.read",
    "conduct.incident.read",
    "engagement.event.read",
    "communication.message.read",
    "document.report_card.read",
    "payment.create",
    "payment.read",
  ],
  parent: [
    "tenant.school.read",
    "access.session.read",
    "identity.person.read",
    "identity.person.edit",
    "enrollment.admission.read",
    "calendar.year.read",
    "calendar.event.read",
    "assessment.results.read",
    "attendance.record.read",
    "homework.read",
    "conduct.incident.read",
    "engagement.event.read",
    "communication.message.read",
    "document.report_card.read",
    "fee.invoice.read",
    "payment.read",
    "payment.create",
  ],
};

export function hierarchyRank(role: SystemRoleCode): number {
  const i = ROLE_HIERARCHY.indexOf(role);
  return i < 0 ? 999 : i;
}

/** Higher (lower rank number) may grant keys ⊆ own bundle, not school_admin role. */
export function canGrantRole(
  granter: SystemRoleCode,
  target: SystemRoleCode,
): boolean {
  if (target === "school_admin") {
    return false;
  }
  return hierarchyRank(granter) < hierarchyRank(target);
}
