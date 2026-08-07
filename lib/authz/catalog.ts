/**
 * Permission key catalog (E03). Keep in sync with authz_permissions seed + rbac.md.
 */
export const PERMISSION_KEYS = [
  // Tenant / access
  "tenant.school.read",
  "tenant.school.edit",
  "tenant.school.archive",
  "access.session.read",
  "access.invite.create",
  "access.invite.revoke",
  // AuthZ admin
  "authz.role.read",
  "authz.role.grant",
  "authz.role.revoke",
  "authz.role.create_custom",
  // Identity
  "identity.person.read",
  "identity.person.edit",
  "identity.person.create",
  // Workforce
  "workforce.employment.read",
  "workforce.employment.create",
  "workforce.employment.edit",
  "workforce.employment.archive",
  "workforce.teacher.invite",
  "workforce.workspace.read",
  "workforce.department.read",
  "workforce.department.edit",
  // Enrollment
  "enrollment.admission.read",
  "enrollment.admission.create",
  "enrollment.admission.edit",
  "enrollment.placement.edit",
  // Config / catalog
  "config.catalog.read",
  "config.catalog.edit",
  "config.branding.edit",
  // Calendar
  "calendar.year.read",
  "calendar.year.edit",
  "calendar.year.lock",
  "calendar.year.unlock",
  "calendar.event.read",
  "calendar.event.create",
  "calendar.event.approve",
  // Structure / timetable
  "structure.class.read",
  "structure.class.edit",
  "timetable.grid.read",
  "timetable.grid.edit",
  "timetable.grid.publish",
  // Assessment
  "assessment.config.read",
  "assessment.config.edit",
  "assessment.results.read",
  "assessment.results.enter",
  "assessment.results.publish",
  "assessment.results.lock",
  "assessment.results.unlock",
  // Attendance
  "attendance.record.read",
  "attendance.record.create",
  "attendance.session.approve",
  "attendance.session.lock",
  "attendance.leave.decide",
  // Conduct
  "conduct.incident.read",
  "conduct.incident.record",
  "conduct.incident.approve",
  // Homework
  "homework.assign",
  "homework.grade",
  "homework.read",
  // Engagement / events
  "engagement.event.read",
  "engagement.event.create",
  "engagement.event.approve",
  // Communication
  "communication.message.read",
  "communication.message.publish",
  "communication.config.edit",
  // Documents / report cards
  "document.report_card.read",
  "document.report_card.issue",
  "document.template.edit",
  // Analytics / audit / onboarding
  "analytics.dashboard.read",
  "audit.entry.read",
  "onboarding.wizard.edit",
  // Fees (placeholder keys for future)
  "fee.invoice.read",
  "fee.invoice.create",
  "fee.waiver.approve",
    "payment.read",
  "payment.create",
  // Curriculum (E30)
  "curriculum.pack.read",
  "curriculum.pack.edit",
  "curriculum.pack.publish",
  "curriculum.pack.archive",
  "curriculum.pack.clone",
  "curriculum.structure.edit",
  "curriculum.outcome.edit",
  "curriculum.resource.edit",
  "curriculum.progress.read",
  "curriculum.progress.record",
  // Assessment Framework (E31)
  "assessment_framework.read",
  "assessment_framework.edit",
  "assessment_framework.publish",
  "assessment_framework.archive",
  "assessment_framework.clone",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

/** Domain tags for docs / UI grouping */
export const PERMISSION_DOMAINS: Record<string, string> = {
  tenant: "E01",
  access: "E02",
  authz: "E03",
  identity: "E04",
  workforce: "E05",
  enrollment: "E06",
  config: "E07",
  calendar: "E08",
  structure: "E09",
  timetable: "E10",
  assessment: "E11",
  attendance: "E12",
  conduct: "E13",
  fee: "E15",
  payment: "E16",
  engagement: "E17",
  communication: "E18",
  document: "E20",
  analytics: "E22",
    audit: "E28",
  homework: "Homework",
  onboarding: "E25",
  curriculum: "E30",
  assessment_framework: "E31",
};
