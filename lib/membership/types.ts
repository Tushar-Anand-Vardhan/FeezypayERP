export const MEMBERSHIP_KINDS = [
  "school_admin",
  "staff",
  "student",
  "parent",
  "alumni",
  "former_staff",
] as const;

export type MembershipKind = (typeof MEMBERSHIP_KINDS)[number];

export const MEMBERSHIP_STATUSES = [
  "invited",
  "active",
  "suspended",
  "ended",
  "transferred",
] as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const CAPABILITY_CLASSES = [
  "admin",
  "teacher",
  "student",
  "parent",
] as const;

export type CapabilityClass = (typeof CAPABILITY_CLASSES)[number];

export const MEMBERSHIP_SOURCE_TYPES = [
  "profile",
  "employment",
  "admission",
  "parent_link",
] as const;

export type MembershipSourceType = (typeof MEMBERSHIP_SOURCE_TYPES)[number];

export type SchoolMembershipRow = {
  id: string;
  personId: string;
  schoolId: string;
  membershipKind: MembershipKind;
  status: MembershipStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  schoolPersona: string | null;
  capabilityClass: CapabilityClass;
  sourceType: MembershipSourceType;
  sourceId: string;
  authzRoleIds: string[];
};

export type ActiveMembershipContext = {
  personId: string;
  authUserId: string;
  schoolId: string;
  membershipId: string | null;
  persona: string;
  membershipKind: MembershipKind | null;
  capabilityClass: CapabilityClass | null;
};
