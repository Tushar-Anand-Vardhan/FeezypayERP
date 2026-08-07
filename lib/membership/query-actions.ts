"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getActiveMembershipContext,
  listMembershipsForPerson,
} from "@/lib/membership/server-helpers";

export async function listMySchoolMembershipsAction() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const authUserId = claimsData?.claims?.sub;
  if (typeof authUserId !== "string") {
    return { success: false as const, error: "You must be signed in." };
  }

  const { data: person } = await supabase
    .from("persons")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!person?.id) {
    return { success: true as const, memberships: [] };
  }

  const memberships = await listMembershipsForPerson(supabase, person.id);
  return { success: true as const, memberships };
}

export async function getActiveMembershipContextAction() {
  const ctx = await getActiveMembershipContext();
  if (!ctx) {
    return { success: false as const, error: "No active membership." };
  }
  return { success: true as const, data: ctx };
}

export async function listMembershipHistoryAction(membershipId: string) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return { success: false as const, error: "You must be signed in." };
  }

  const { data, error } = await supabase
    .from("school_membership_history")
    .select("id, membership_id, changed_at, action, old_row, new_row")
    .eq("membership_id", membershipId)
    .order("changed_at", { ascending: false })
    .limit(50);

  if (error) {
    return { success: false as const, error: error.message };
  }
  return { success: true as const, history: data ?? [] };
}
