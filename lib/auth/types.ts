export const AUTH_PERSONAS = [
  "school_admin",
  "principal",
  "vice_principal",
  "hod",
  "teacher",
  "staff",
  "student",
  "parent",
  "alumni",
] as const;

export type AuthPersona = (typeof AUTH_PERSONAS)[number];

export const INVITE_TARGET_PERSONAS = [
  "teacher",
  "principal",
  "vice_principal",
  "hod",
  "staff",
  "student",
  "parent",
  "alumni",
] as const;

export type InviteTargetPersona = (typeof INVITE_TARGET_PERSONAS)[number];

export const INVITE_STATUSES = [
  "pending",
  "accepted",
  "revoked",
  "expired",
] as const;

export type InviteStatus = (typeof INVITE_STATUSES)[number];

export type AuthMembership = {
  schoolId: string;
  schoolName?: string | null;
  persona: AuthPersona;
  source: "profile" | "employment" | "admission" | "parent_link";
  sourceId: string;
  status: string;
  membershipId?: string | null;
};

export type ActiveContext = {
  schoolId: string;
  persona: AuthPersona;
};

export type AuthBootstrap = {
  authUserId: string;
  personId: string | null;
  profileCompletedAt: string | null;
  email: string | null;
  memberships: AuthMembership[];
  activeContext: ActiveContext | null;
  needsProfileCompletion: boolean;
  isSchoolAdmin: boolean;
};
