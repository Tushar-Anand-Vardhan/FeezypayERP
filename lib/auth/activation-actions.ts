"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  listMembershipsForUser,
  pickDefaultMembership,
} from "@/lib/auth/membership";

type Result =
  | { success: true; redirectTo: string }
  | { success: false; error: string };

/**
 * Bind auth.uid() to persons via pending invite (email match) or metadata person_id.
 */
export async function acceptInviteSessionAction(): Promise<Result> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { success: false, error: "You must be signed in." };
  }

  const user = userData.user;
  const email = user.email?.toLowerCase() ?? null;
  const meta = user.user_metadata ?? {};
  const metaPersonId =
    typeof meta.person_id === "string" ? meta.person_id : null;
  const metaInviteId =
    typeof meta.invite_id === "string" ? meta.invite_id : null;

  // Already bound?
  const { data: existingPerson } = await supabase
    .from("persons")
    .select("id, profile_completed_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existingPerson) {
    await ensureActiveContext(supabase, user.id);
    return {
      success: true,
      redirectTo: existingPerson.profile_completed_at
        ? "/dashboard"
        : "/activate/profile",
    };
  }

  // Locate pending invite
  let inviteQuery = supabase
    .from("auth_invites")
    .select(
      "id, school_id, person_id, target_persona, employment_id, status, expires_at, email",
    )
    .eq("status", "pending")
    .is("archived_at", null);

  if (metaInviteId) {
    inviteQuery = inviteQuery.eq("id", metaInviteId);
  } else if (email) {
    inviteQuery = inviteQuery.ilike("email", email);
  } else {
    return {
      success: false,
      error: "No invite metadata or email to accept.",
    };
  }

  const { data: invites, error: inviteError } = await inviteQuery
    .order("created_at", { ascending: false })
    .limit(1);

  if (inviteError) {
    return { success: false, error: inviteError.message };
  }

  const invite = invites?.[0];
  if (!invite) {
    // Allow bind via metadata person_id without invite row (edge recovery)
    if (metaPersonId) {
      const bind = await bindPerson(supabase, metaPersonId, user.id);
      if (!bind.success) {
        return bind;
      }
      await ensureActiveContext(supabase, user.id);
      return { success: true, redirectTo: "/activate/profile" };
    }
    return {
      success: false,
      error: "No pending invite found for this account.",
    };
  }

  if (new Date(invite.expires_at) < new Date()) {
    await supabase
      .from("auth_invites")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", invite.id);
    return { success: false, error: "This invite has expired." };
  }

  const personId = metaPersonId ?? invite.person_id;
  const bind = await bindPerson(supabase, personId, user.id);
  if (!bind.success) {
    return bind;
  }

  await supabase
    .from("auth_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      auth_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  await supabase.from("user_active_context").upsert(
    {
      auth_user_id: user.id,
      school_id: invite.school_id,
      persona:
        invite.target_persona === "teacher" ||
        invite.target_persona === "principal" ||
        invite.target_persona === "vice_principal" ||
        invite.target_persona === "hod" ||
        invite.target_persona === "staff" ||
        invite.target_persona === "student" ||
        invite.target_persona === "parent" ||
        invite.target_persona === "alumni"
          ? invite.target_persona
          : "teacher",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "auth_user_id" },
  );

  const { data: person } = await supabase
    .from("persons")
    .select("profile_completed_at")
    .eq("id", personId)
    .maybeSingle();

  revalidatePath("/");
  return {
    success: true,
    redirectTo: person?.profile_completed_at
      ? "/dashboard"
      : "/activate/profile",
  };
}

async function bindPerson(
  supabase: Awaited<ReturnType<typeof createClient>>,
  personId: string,
  authUserId: string,
): Promise<Result | { success: true }> {
  const { data: person, error } = await supabase
    .from("persons")
    .select("id, auth_user_id")
    .eq("id", personId)
    .maybeSingle();

  if (error || !person) {
    return { success: false, error: "Person record not found for invite." };
  }

  if (person.auth_user_id && person.auth_user_id !== authUserId) {
    return {
      success: false,
      error: "This person is already linked to another login.",
    };
  }

  if (!person.auth_user_id) {
    const { error: updError } = await supabase
      .from("persons")
      .update({ auth_user_id: authUserId })
      .eq("id", personId);

    if (updError) {
      return { success: false, error: updError.message };
    }
  }

  return { success: true };
}

async function ensureActiveContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authUserId: string,
) {
  const { data: existing } = await supabase
    .from("user_active_context")
    .select("auth_user_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (existing) {
    return;
  }

  const memberships = await listMembershipsForUser(supabase, authUserId);
  const def = pickDefaultMembership(memberships);
  if (!def) {
    return;
  }

  await supabase.from("user_active_context").upsert(
    {
      auth_user_id: authUserId,
      school_id: def.schoolId,
      persona: def.persona,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "auth_user_id" },
  );
}
