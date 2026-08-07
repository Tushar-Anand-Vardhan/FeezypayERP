import type { SupabaseClient } from "@supabase/supabase-js";
import { syncAdminMembership } from "@/lib/membership/sync";

/**
 * Ensure school_admin profile has an indexed membership (post-signup).
 */
export async function ensureAdminMembershipIndexed(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, school_id, role")
    .eq("id", authUserId)
    .maybeSingle();

  if (!profile || profile.role !== "school_admin" || !profile.school_id) {
    return;
  }

  const { data: existing } = await supabase
    .from("school_memberships")
    .select("id")
    .eq("source_type", "profile")
    .eq("source_id", profile.id)
    .maybeSingle();

  if (existing) {
    return;
  }

  await syncAdminMembership(supabase, {
    authUserId,
    schoolId: profile.school_id,
    profileId: profile.id,
  });
}
