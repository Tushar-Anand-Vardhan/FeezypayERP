"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import type { InviteTargetPersona } from "@/lib/auth/types";
import { INVITE_TARGET_PERSONAS } from "@/lib/auth/types";

type Result =
  | { success: true; inviteId: string; warning?: string }
  | { success: false; error: string };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isInvitePersona(value: string): value is InviteTargetPersona {
  return (INVITE_TARGET_PERSONAS as readonly string[]).includes(value);
}

async function writeAdminAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    schoolId: string;
    actorId: string;
    action: string;
    targetEmail?: string;
    inviteId?: string;
    detail?: Record<string, unknown>;
  },
) {
  await supabase.from("auth_admin_audit_log").insert({
    school_id: input.schoolId,
    actor_auth_user_id: input.actorId,
    action: input.action,
    target_email: input.targetEmail ?? null,
    invite_id: input.inviteId ?? null,
    detail: input.detail ?? {},
  });
}

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

  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    return { success: false, error: "A valid invite email is required." };
  }
  if (!input.personId) {
    return { success: false, error: "personId is required." };
  }
  if (!isInvitePersona(input.targetPersona)) {
    return { success: false, error: "Invalid target persona." };
  }

  const { supabase, schoolId } = context;
  const { data: claims } = await supabase.auth.getClaims();
  const actorId = claims?.claims?.sub;
  if (typeof actorId !== "string") {
    return { success: false, error: "You must be signed in." };
  }

  if (
    input.employmentId &&
    (input.targetPersona === "teacher" || input.targetPersona === "hod")
  ) {
    const { data: employment } = await supabase
      .from("teacher_employments")
      .select("teacher_profile_id")
      .eq("id", input.employmentId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (employment?.teacher_profile_id) {
      const { assertNoOtherActiveEmployment } = await import(
        "@/lib/workforce/employment-guards"
      );
      const d15 = await assertNoOtherActiveEmployment(
        supabase,
        employment.teacher_profile_id,
        schoolId,
      );
      if (!d15.ok) {
        return { success: false, error: d15.error };
      }
    }
  }

  const { data: invite, error: insertError } = await supabase
    .from("auth_invites")
    .insert({
      school_id: schoolId,
      email,
      person_id: input.personId,
      target_persona: input.targetPersona,
      employment_id: input.employmentId ?? null,
      admission_id: input.admissionId ?? null,
      parent_profile_id: input.parentProfileId ?? null,
      status: "pending",
      invited_by: actorId,
    })
    .select("id")
    .single();

  if (insertError || !invite) {
    return {
      success: false,
      error: insertError?.message ?? "Could not create invite.",
    };
  }

  let warning: string | undefined;

  if (!hasServiceRoleKey()) {
    warning =
      "Invite saved, but SUPABASE_SERVICE_ROLE_KEY is not configured — Auth email was not sent.";
    await writeAdminAudit(supabase, {
      schoolId,
      actorId,
      action: "invite.create_without_send",
      targetEmail: email,
      inviteId: invite.id,
    });
  } else {
    try {
      const admin = createAdminClient();
      const origin =
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/invite/accept")}&type=invite`,
          data: {
            intent: "accept_invite",
            invite_id: invite.id,
            person_id: input.personId,
            school_id: schoolId,
          },
        },
      );

      if (inviteError) {
        // User may already exist — try generateLink recovery as fallback messaging path
        const { data: linkData, error: linkError } =
          await admin.auth.admin.generateLink({
            type: "invite",
            email,
            options: {
              redirectTo: `${origin}/invite/accept`,
              data: {
                intent: "accept_invite",
                invite_id: invite.id,
                person_id: input.personId,
                school_id: schoolId,
              },
            },
          });

        if (linkError) {
          warning = `Invite row created but Auth invite failed: ${inviteError.message}`;
        } else {
          warning = linkData?.properties?.action_link
            ? "Invite created. User may already exist — share the generated invite link from Auth if email did not arrive."
            : undefined;
        }
      }

      await writeAdminAudit(supabase, {
        schoolId,
        actorId,
        action: "invite.send",
        targetEmail: email,
        inviteId: invite.id,
        detail: { warning: warning ?? null },
      });
    } catch (err) {
      warning =
        err instanceof Error
          ? err.message
          : "Invite saved but Auth admin call failed.";
      await writeAdminAudit(supabase, {
        schoolId,
        actorId,
        action: "invite.send_error",
        targetEmail: email,
        inviteId: invite.id,
        detail: { error: warning },
      });
    }
  }

  revalidatePath("/dashboard");
  return { success: true, inviteId: invite.id, warning };
}

export async function revokeInviteAction(inviteId: string): Promise<Result> {
  const context = await getAuthenticatedSchoolContext("access.invite.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }
  const { supabase, schoolId } = context;
  const { data: claims } = await supabase.auth.getClaims();
  const actorId = claims?.claims?.sub;
  if (typeof actorId !== "string") {
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

  await writeAdminAudit(supabase, {
    schoolId,
    actorId,
    action: "invite.revoke",
    inviteId,
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
    .select("id, email, person_id, target_persona, employment_id, admission_id, parent_profile_id, status")
    .eq("id", inviteId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error || !invite) {
    return { success: false, error: "Invite not found." };
  }
  if (invite.status !== "pending") {
    return { success: false, error: "Only pending invites can be resent." };
  }

  // Revoke uniqueness constraint by archiving old pending, recreate
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
