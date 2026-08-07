import type { PermissionKey } from "@/lib/authz/catalog";
import type {
  AuthzActor,
  AuthzAttrs,
  AuthzDecision,
} from "@/lib/authz/types";

const DEPT_SCOPED_KEYS = new Set<PermissionKey>([
  "workforce.department.edit",
  "assessment.results.publish",
  "assessment.results.lock",
  "conduct.incident.approve",
]);

const SUBJECT_SCOPED_KEYS = new Set<PermissionKey>([
  "assessment.results.enter",
  "attendance.record.create",
  "homework.assign",
  "homework.grade",
]);

const LINKED_CHILD_KEYS = new Set<PermissionKey>([
  "assessment.results.read",
  "attendance.record.read",
  "homework.read",
  "conduct.incident.read",
  "document.report_card.read",
  "enrollment.admission.read",
  "fee.invoice.read",
  "payment.create",
]);

export function hasPermission(
  actor: AuthzActor,
  key: PermissionKey,
  attrs?: AuthzAttrs,
): AuthzDecision {
  if (attrs?.schoolId && attrs.schoolId !== actor.schoolId) {
    return { allow: false, reason: "School scope mismatch." };
  }

  if (!actor.permissionKeys.has(key)) {
    return { allow: false, reason: `Missing permission: ${key}` };
  }

  if (attrs?.yearClosed) {
    const mutating =
      key.includes(".edit") ||
      key.includes(".create") ||
      key.includes(".enter") ||
      key.includes(".assign");
    if (mutating && !actor.permissionKeys.has("calendar.year.unlock")) {
      return {
        allow: false,
        reason: "Academic year is closed.",
      };
    }
  }

  // Self identity
  if (
    (key === "identity.person.edit" || key === "identity.person.read") &&
    attrs?.resourcePersonId &&
    actor.personId &&
    attrs.resourcePersonId !== actor.personId &&
    !actor.isSchoolAdmin &&
    !actor.systemRoles.includes("principal")
  ) {
    return { allow: false, reason: "Can only access own identity." };
  }

  // HOD department scope
  if (
    actor.activePersona === "hod" ||
    actor.systemRoles.includes("hod")
  ) {
    if (
      DEPT_SCOPED_KEYS.has(key) &&
      attrs?.departmentId &&
      actor.departmentIds.length > 0 &&
      !actor.departmentIds.includes(attrs.departmentId)
    ) {
      return { allow: false, reason: "Outside your department scope." };
    }
  }

  // Teacher subject scope
  if (
    (actor.activePersona === "teacher" ||
      actor.systemRoles.includes("teacher")) &&
    !actor.isSchoolAdmin &&
    !actor.systemRoles.includes("principal") &&
    !actor.systemRoles.includes("hod")
  ) {
    if (
      SUBJECT_SCOPED_KEYS.has(key) &&
      attrs?.subjectId &&
      actor.subjectIds.length > 0 &&
      !actor.subjectIds.includes(attrs.subjectId)
    ) {
      return {
        allow: false,
        reason: "Subject is not on your teaching assignment.",
      };
    }
  }

  // Parent linked children
  if (
    (actor.activePersona === "parent" ||
      actor.systemRoles.includes("parent")) &&
    !actor.isSchoolAdmin
  ) {
    if (LINKED_CHILD_KEYS.has(key)) {
      const childId = attrs?.studentProfileId;
      if (
        childId &&
        actor.linkedStudentProfileIds.length > 0 &&
        !actor.linkedStudentProfileIds.includes(childId)
      ) {
        return { allow: false, reason: "Child is not linked to this parent." };
      }
    }
  }

  return { allow: true };
}
