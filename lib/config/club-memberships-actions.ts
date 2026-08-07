"use server";

/** Compatibility re-exports — House & Club Engine owns memberships. */
export {
  addClubMembershipAction as joinClubAction,
  endClubMembershipAction as leaveClubAction,
  addClubMembershipAction,
  endClubMembershipAction,
  listClubMembershipsAction,
} from "@/lib/houses-clubs/club-memberships-actions";
