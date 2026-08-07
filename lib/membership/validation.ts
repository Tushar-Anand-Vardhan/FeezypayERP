import {
  CAPABILITY_CLASSES,
  MEMBERSHIP_KINDS,
  MEMBERSHIP_SOURCE_TYPES,
  MEMBERSHIP_STATUSES,
  type CapabilityClass,
  type MembershipKind,
  type MembershipSourceType,
  type MembershipStatus,
} from "@/lib/membership/types";

export function isMembershipKind(value: string): value is MembershipKind {
  return (MEMBERSHIP_KINDS as readonly string[]).includes(value);
}

export function isMembershipStatus(value: string): value is MembershipStatus {
  return (MEMBERSHIP_STATUSES as readonly string[]).includes(value);
}

export function isCapabilityClass(value: string): value is CapabilityClass {
  return (CAPABILITY_CLASSES as readonly string[]).includes(value);
}

export function isMembershipSourceType(
  value: string,
): value is MembershipSourceType {
  return (MEMBERSHIP_SOURCE_TYPES as readonly string[]).includes(value);
}

export function staffPersonaFromEmployment(input: {
  schoolPersona?: string | null;
  isHod?: boolean | null;
  employmentType?: string | null;
  status?: string | null;
}): { kind: MembershipKind; persona: string; status: MembershipStatus } {
  const status: MembershipStatus =
    input.status === "invited"
      ? "invited"
      : input.status === "ended"
        ? "ended"
        : "active";

  const kind: MembershipKind =
    status === "ended" ? "former_staff" : "staff";

  let persona = input.schoolPersona ?? "teacher";
  if (input.isHod) {
    persona = "hod";
  } else if (
    input.employmentType === "consultant" ||
    input.employmentType === "substitute"
  ) {
    persona = input.employmentType;
  }

  return { kind, persona, status };
}

export function studentPersonaFromAdmission(status: string): {
  kind: MembershipKind;
  persona: string;
  membershipStatus: MembershipStatus;
} {
  if (status === "alumni") {
    return { kind: "alumni", persona: "alumni", membershipStatus: "active" };
  }
  if (status === "transferred") {
    return {
      kind: "student",
      persona: "student",
      membershipStatus: "transferred",
    };
  }
  if (status === "withdrawn") {
    return { kind: "student", persona: "student", membershipStatus: "ended" };
  }
  return { kind: "student", persona: "student", membershipStatus: "active" };
}

export function isDateEffective(
  from: string,
  to: string | null,
  asOf: string = new Date().toISOString().slice(0, 10),
): boolean {
  if (from > asOf) {
    return false;
  }
  if (to != null && to < asOf) {
    return false;
  }
  return true;
}
