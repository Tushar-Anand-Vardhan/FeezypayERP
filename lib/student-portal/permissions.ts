import type { PermissionKey } from "@/lib/authz/catalog";

/** Permission keys referenced by Student Portal routes / smoke. */
export const STUDENT_PORTAL_PERMISSIONS = [
  "enrollment.admission.read",
  "attendance.record.read",
  "assessment.results.read",
  "homework.read",
  "document.report_card.read",
  "communication.message.read",
  "engagement.event.read",
  "conduct.incident.read",
  "identity.person.read",
  "calendar.year.read",
] as const satisfies readonly PermissionKey[];

export type StudentPortalPermission =
  (typeof STUDENT_PORTAL_PERMISSIONS)[number];

/**
 * V1 write allowlist — empty. Student portal clients must not import
 * mutating engine actions except keys listed here (none yet).
 */
export const STUDENT_PORTAL_WRITE_ALLOWLIST: readonly string[] = [];
