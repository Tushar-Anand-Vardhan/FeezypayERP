import type { PermissionKey } from "@/lib/authz/catalog";

/** Permission keys referenced by Teacher Portal routes / smoke. */
export const TEACHER_PORTAL_PERMISSIONS = [
  "workforce.workspace.read",
  "attendance.record.create",
  "attendance.record.read",
  "enrollment.admission.read",
  "assessment.results.enter",
  "assessment.results.read",
  "assessment.results.publish",
  "homework.assign",
  "homework.read",
  "homework.grade",
  "conduct.incident.record",
  "conduct.incident.read",
  "engagement.event.read",
  "engagement.event.create",
  "communication.message.read",
  "workforce.department.read",
  "workforce.department.edit",
  "identity.person.read",
  "identity.person.edit",
] as const satisfies readonly PermissionKey[];

export type TeacherPortalPermission =
  (typeof TEACHER_PORTAL_PERMISSIONS)[number];
