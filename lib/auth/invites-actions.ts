"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import {
  createInviteForSchool,
  type InviteResult,
} from "@/lib/auth/create-invite";

type Result = InviteResult;

export async function createInviteAction(input: {
  email: string;
  personId: string;
  targetPersona: string;
  employmentId?: string | null;
  admissionId?: string | null;
  parentProfileId?: string | null;
}): Promise<Result> {
  const context = await getAuthenticatedSchoolContext("access.invite.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const actorId = context.actor?.authUserId;
  if (!actorId) {
    return { success: false, error: "You must be signed in." };
  }

  const result = await createInviteForSchool({
    supabase: context.supabase,
    schoolId: context.schoolId,
    actorId,
    draft: input,
    checkEmploymentGuard: true,
  });

  if (result.success) {
    revalidatePath("/dashboard");
  }
  return result;
}

export async function revokeInviteAction(inviteId: string): Promise<Result> {
  const context = await getAuthenticatedSchoolContext("access.invite.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }
  const { supabase, schoolId } = context;
  const actorId = context.actor?.authUserId;
  if (!actorId) {
    return { success: false, error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("auth_invites")
    .update({
      status: "revoked",
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", inviteId)
    .eq("school_id", schoolId)
    .eq("status", "pending");

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase.from("auth_admin_audit_log").insert({
    school_id: schoolId,
    actor_auth_user_id: actorId,
    action: "invite.revoke",
    invite_id: inviteId,
    detail: {},
  });

  return { success: true, inviteId };
}

export async function resendInviteAction(inviteId: string): Promise<Result> {
  const context = await getAuthenticatedSchoolContext("access.invite.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }
  const { supabase, schoolId } = context;

  const { data: invite, error } = await supabase
    .from("auth_invites")
    .select(
      "id, email, person_id, target_persona, employment_id, admission_id, parent_profile_id, status",
    )
    .eq("id", inviteId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error || !invite) {
    return { success: false, error: "Invite not found." };
  }
  if (invite.status !== "pending") {
    return { success: false, error: "Only pending invites can be resent." };
  }

  await supabase
    .from("auth_invites")
    .update({
      status: "expired",
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", inviteId);

  return createInviteAction({
    email: invite.email,
    personId: invite.person_id,
    targetPersona: invite.target_persona,
    employmentId: invite.employment_id,
    admissionId: invite.admission_id,
    parentProfileId: invite.parent_profile_id,
  });
}
