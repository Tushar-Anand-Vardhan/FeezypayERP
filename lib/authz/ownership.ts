import type { AuthzActor, AuthzAttrs, AuthzDecision } from "@/lib/authz/types";

export function assertDepartmentScope(
  actor: AuthzActor,
  departmentId: string | null | undefined,
): AuthzDecision {
  if (!departmentId) {
    return { allow: true };
  }
  if (actor.isSchoolAdmin || actor.systemRoles.includes("principal")) {
    return { allow: true };
  }
  if (
    actor.departmentIds.length > 0 &&
    !actor.departmentIds.includes(departmentId)
  ) {
    return { allow: false, reason: "Outside department ownership." };
  }
  return { allow: true };
}

export function assertSubjectScope(
  actor: AuthzActor,
  subjectId: string | null | undefined,
): AuthzDecision {
  if (!subjectId) {
    return { allow: true };
  }
  if (
    actor.isSchoolAdmin ||
    actor.systemRoles.includes("principal") ||
    actor.systemRoles.includes("hod")
  ) {
    return { allow: true };
  }
  if (
    actor.subjectIds.length > 0 &&
    !actor.subjectIds.includes(subjectId)
  ) {
    return { allow: false, reason: "Subject not owned by employment." };
  }
  return { allow: true };
}

export function assertLinkedChild(
  actor: AuthzActor,
  studentProfileId: string | null | undefined,
): AuthzDecision {
  if (!studentProfileId) {
    return { allow: true };
  }
  if (actor.isSchoolAdmin || actor.systemRoles.includes("principal")) {
    return { allow: true };
  }
  if (
    actor.linkedStudentProfileIds.length > 0 &&
    !actor.linkedStudentProfileIds.includes(studentProfileId)
  ) {
    return { allow: false, reason: "Student is not a linked child." };
  }
  return { allow: true };
}

export function assertOwnsPerson(
  actor: AuthzActor,
  resourcePersonId: string | null | undefined,
): AuthzDecision {
  if (!resourcePersonId || !actor.personId) {
    return { allow: true };
  }
  if (resourcePersonId === actor.personId) {
    return { allow: true };
  }
  if (actor.isSchoolAdmin || actor.systemRoles.includes("principal")) {
    return { allow: true };
  }
  return { allow: false, reason: "Not the resource owner." };
}

export function combineOwnership(
  actor: AuthzActor,
  attrs?: AuthzAttrs,
): AuthzDecision {
  const checks = [
    assertDepartmentScope(actor, attrs?.departmentId),
    assertSubjectScope(actor, attrs?.subjectId),
    assertLinkedChild(actor, attrs?.studentProfileId),
    assertOwnsPerson(actor, attrs?.resourcePersonId),
  ];
  for (const c of checks) {
    if (!c.allow) {
      return c;
    }
  }
  return { allow: true };
}
