import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import type { InviteTargetPersona } from "@/lib/auth/types";
import { INVITE_TARGET_PERSONAS } from "@/lib/auth/types";
import { mapPool, ONBOARDING_INVITE_CONCURRENCY } from "@/lib/onboarding/parallel";

type Supabase = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

export type InviteResult =
  | { success: true; inviteId: string; warning?: string }
  | { success: false; error: string };

export type InviteDraft = {
  email: string;
  personId: string;
  targetPersona: string;
  employmentId?: string | null;
  admissionId?: string | null;
  parentProfileId?: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isInvitePersona(value: string): value is InviteTargetPersona {
  return (INVITE_TARGET_PERSONAS as readonly string[]).includes(value);
}

async function sendAuthInviteEmail(input: {
  email: string;
  inviteId: string;
  personId: string;
  schoolId: string;
}): Promise<string | undefined> {
  const admin = createAdminClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    {
      redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/invite/accept")}&type=invite`,
      data: {
        intent: "accept_invite",
        invite_id: input.inviteId,
        person_id: input.personId,
        school_id: input.schoolId,
      },
    },
  );

  if (!inviteError) {
    return undefined;
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: input.email,
    options: {
      redirectTo: `${origin}/invite/accept`,
      data: {
        intent: "accept_invite",
        invite_id: input.inviteId,
        person_id: input.personId,
        school_id: input.schoolId,
      },
    },
  });

  if (linkError) {
    return `Invite row created but Auth invite failed: ${inviteError.message}`;
  }
  return linkData?.properties?.action_link
    ? "Invite created. User may already exist — share the generated invite link from Auth if email did not arrive."
    : undefined;
}

function validateDraft(
  input: InviteDraft,
):
  | { ok: true; email: string; persona: InviteTargetPersona }
  | { ok: false; error: string } {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    return { ok: false, error: "A valid invite email is required." };
  }
  if (!input.personId) {
    return { ok: false, error: "personId is required." };
  }
  if (!isInvitePersona(input.targetPersona)) {
    return { ok: false, error: "Invalid target persona." };
  }
  return { ok: true, email, persona: input.targetPersona };
}

/**
 * Create one invite using an already-authenticated school client.
 * Callers that already ran D15 can skip the employment guard.
 */
export async function createInviteForSchool(input: {
  supabase: Supabase;
  schoolId: string;
  actorId: string;
  draft: InviteDraft;
  checkEmploymentGuard?: boolean;
}): Promise<InviteResult> {
  const parsed = validateDraft(input.draft);
  if (!parsed.ok) {
    return { success: false, error: parsed.error };
  }

  if (input.checkEmploymentGuard !== false) {
    const { assertNoOtherActiveEmployment } = await import(
      "@/lib/workforce/employment-guards"
    );
    if (
      input.draft.employmentId &&
      (parsed.persona === "teacher" || parsed.persona === "hod")
    ) {
      const { data: employment } = await input.supabase
        .from("teacher_employments")
        .select("teacher_profile_id")
        .eq("id", input.draft.employmentId)
        .eq("school_id", input.schoolId)
        .maybeSingle();
      if (employment?.teacher_profile_id) {
        const d15 = await assertNoOtherActiveEmployment(
          input.supabase,
          employment.teacher_profile_id,
          input.schoolId,
        );
        if (!d15.ok) {
          return { success: false, error: d15.error };
        }
      }
    }
  }

  const { data: invite, error: insertError } = await input.supabase
    .from("auth_invites")
    .insert({
      school_id: input.schoolId,
      email: parsed.email,
      person_id: input.draft.personId,
      target_persona: parsed.persona,
      employment_id: input.draft.employmentId ?? null,
      admission_id: input.draft.admissionId ?? null,
      parent_profile_id: input.draft.parentProfileId ?? null,
      status: "pending",
      invited_by: input.actorId,
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
    await input.supabase.from("auth_admin_audit_log").insert({
      school_id: input.schoolId,
      actor_auth_user_id: input.actorId,
      action: "invite.create_without_send",
      target_email: parsed.email,
      invite_id: invite.id,
      detail: {},
    });
  } else {
    try {
      warning = await sendAuthInviteEmail({
        email: parsed.email,
        inviteId: invite.id,
        personId: input.draft.personId,
        schoolId: input.schoolId,
      });
      await input.supabase.from("auth_admin_audit_log").insert({
        school_id: input.schoolId,
        actor_auth_user_id: input.actorId,
        action: "invite.send",
        target_email: parsed.email,
        invite_id: invite.id,
        detail: { warning: warning ?? null },
      });
    } catch (err) {
      warning =
        err instanceof Error
          ? err.message
          : "Invite saved but Auth admin call failed.";
      await input.supabase.from("auth_admin_audit_log").insert({
        school_id: input.schoolId,
        actor_auth_user_id: input.actorId,
        action: "invite.send_error",
        target_email: parsed.email,
        invite_id: invite.id,
        detail: { error: warning },
      });
    }
  }

  return { success: true, inviteId: invite.id, warning };
}

export type BulkInviteOutcome = {
  sent: number;
  skipped: number;
  warnings: string[];
};

/**
 * Insert pending invite rows (skipping emails that already have one), then
 * send Auth emails in parallel. Does not re-run AuthZ or D15.
 */
export async function createInvitesForSchoolBulk(input: {
  supabase: Supabase;
  schoolId: string;
  actorId: string;
  drafts: InviteDraft[];
}): Promise<BulkInviteOutcome> {
  const warnings: string[] = [];
  const unique = new Map<string, InviteDraft & { email: string; persona: InviteTargetPersona }>();

  for (const draft of input.drafts) {
    const parsed = validateDraft(draft);
    if (!parsed.ok) {
      warnings.push(`${draft.email || "(blank)"}: ${parsed.error}`);
      continue;
    }
    if (!unique.has(parsed.email)) {
      unique.set(parsed.email, {
        ...draft,
        email: parsed.email,
        persona: parsed.persona,
      });
    }
  }

  if (unique.size === 0) {
    return { sent: 0, skipped: 0, warnings };
  }

  const pending = new Set<string>();
  const { data: existing } = await input.supabase
    .from("auth_invites")
    .select("email")
    .eq("school_id", input.schoolId)
    .eq("status", "pending");
  for (const row of existing ?? []) {
    if (row.email) {
      pending.add(row.email.toLowerCase());
    }
  }

  const toInsert = Array.from(unique.values()).filter(
    (draft) => !pending.has(draft.email),
  );
  const skipped = unique.size - toInsert.length;

  if (toInsert.length === 0) {
    return { sent: 0, skipped, warnings };
  }

  const { data: inserted, error: insertError } = await input.supabase
    .from("auth_invites")
    .insert(
      toInsert.map((draft) => ({
        school_id: input.schoolId,
        email: draft.email,
        person_id: draft.personId,
        target_persona: draft.persona,
        employment_id: draft.employmentId ?? null,
        admission_id: draft.admissionId ?? null,
        parent_profile_id: draft.parentProfileId ?? null,
        status: "pending",
        invited_by: input.actorId,
      })),
    )
    .select("id, email, person_id");

  if (insertError || !inserted) {
    warnings.push(insertError?.message ?? "Could not create invite rows.");
    return { sent: 0, skipped, warnings };
  }

  const auditRows: Array<{
    school_id: string;
    actor_auth_user_id: string;
    action: string;
    target_email: string;
    invite_id: string;
    detail: Record<string, unknown>;
  }> = [];

  if (!hasServiceRoleKey()) {
    warnings.push(
      "Invites saved, but SUPABASE_SERVICE_ROLE_KEY is not configured — Auth emails were not sent.",
    );
    for (const invite of inserted) {
      auditRows.push({
        school_id: input.schoolId,
        actor_auth_user_id: input.actorId,
        action: "invite.create_without_send",
        target_email: invite.email,
        invite_id: invite.id,
        detail: {},
      });
    }
  } else {
    await mapPool(inserted, ONBOARDING_INVITE_CONCURRENCY, async (invite) => {
      let warning: string | undefined;
      let action = "invite.send";
      try {
        warning = await sendAuthInviteEmail({
          email: invite.email,
          inviteId: invite.id,
          personId: invite.person_id,
          schoolId: input.schoolId,
        });
      } catch (err) {
        action = "invite.send_error";
        warning =
          err instanceof Error
            ? err.message
            : "Invite saved but Auth admin call failed.";
      }
      if (warning) {
        warnings.push(`${invite.email}: ${warning}`);
      }
      auditRows.push({
        school_id: input.schoolId,
        actor_auth_user_id: input.actorId,
        action,
        target_email: invite.email,
        invite_id: invite.id,
        detail: { warning: warning ?? null },
      });
    });
  }

  if (auditRows.length > 0) {
    await input.supabase.from("auth_admin_audit_log").insert(auditRows);
  }

  return { sent: inserted.length, skipped, warnings };
}
