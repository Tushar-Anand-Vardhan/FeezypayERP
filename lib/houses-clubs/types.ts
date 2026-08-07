/** House & Club Engine (E07 surface) types. */

export type HouseClubActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type MembershipRole = "member" | "captain" | "vice_captain";

export type HouseCatalogInput = {
  id?: string;
  name: string;
  code?: string;
  description?: string;
  colour?: string;
  secondaryColour?: string;
  logoPath?: string | null;
  academicYearId?: string | null;
  teacherInChargeEmploymentId?: string | null;
  displayOrder?: number;
  pointsTrackingEnabled?: boolean;
};

export type ClubCatalogInput = {
  id?: string;
  name: string;
  code?: string;
  description?: string;
  colour?: string;
  logoPath?: string | null;
  academicYearId?: string | null;
  teacherInChargeEmploymentId?: string | null;
  displayOrder?: number;
  eventsEnabled?: boolean;
};

export type HouseMembershipInput = {
  houseId: string;
  studentProfileId: string;
  role?: MembershipRole;
  academicYearId?: string | null;
  joinedOn?: string;
  notes?: string;
};

export type ClubMembershipInput = {
  clubId: string;
  studentProfileId: string;
  role?: MembershipRole;
  academicYearId?: string | null;
  joinedOn?: string;
  notes?: string;
};

export const MEMBERSHIP_ROLES: MembershipRole[] = [
  "member",
  "captain",
  "vice_captain",
];

export const MEMBERSHIP_ROLE_LABELS: Record<MembershipRole, string> = {
  member: "Member",
  captain: "Captain",
  vice_captain: "Vice captain",
};
