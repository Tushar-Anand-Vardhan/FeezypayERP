"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  listMembershipsForUser,
  pickDefaultMembership,
} from "@/lib/auth/membership";
import type { AuthBootstrap, AuthPersona } from "@/lib/auth/types";
import { AUTH_PERSONAS } from "@/lib/auth/types";
import { ensureAdminMembershipIndexed } from "@/lib/membership/ensure-admin";
import { switchActiveSchoolAction } from "@/lib/membership/switch-school-actions";

type Result = { success: true } | { success: false; error: string };

function isPersona(value: string): value is AuthPersona {
  return (AUTH_PERSONAS as readonly string[]).includes(value);
}

export async function getAuthBootstrapAction(): Promise<
  { success: true; data: AuthBootstrap } | { success: false; error: string }
> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const authUserId = claimsData?.claims?.sub;
  if (typeof authUserId !== "string") {
    return { success: false, error: "You must be signed in." };
  }

  const email =
    typeof claimsData?.claims?.email === "string"
      ? claimsData.claims.email
      : null;

  await ensureAdminMembershipIndexed(supabase, authUserId);

  const { data: person } = await supabase
    .from("persons")
    .select("id, profile_completed_at, email")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const memberships = await listMembershipsForUser(supabase, authUserId);

  const schoolIds = [...new Set(memberships.map((m) => m.schoolId))];
  if (schoolIds.length > 0) {
    const { data: schools } = await supabase
      .from("schools")
      .select("id, name")
      .in("id", schoolIds);
    const nameById = new Map((schools ?? []).map((s) => [s.id, s.name]));
    for (const m of memberships) {
      m.schoolName = nameById.get(m.schoolId) ?? null;
    }
  }

  // Attach E29 membership ids when present
  if (person?.id) {
    const { data: indexed } = await supabase
      .from("school_memberships")
      .select("id, source_type, source_id")
      .eq("person_id", person.id)
      .is("archived_at", null);
    const bySource = new Map(
      (indexed ?? []).map((r) => [`${r.source_type}:${r.source_id}`, r.id]),
    );
    for (const m of memberships) {
      m.membershipId = bySource.get(`${m.source}:${m.sourceId}`) ?? null;
    }
  }

  const { data: ctx } = await supabase
    .from("user_active_context")
    .select("school_id, persona")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  let activeContext = ctx
    ? { schoolId: ctx.school_id as string, persona: ctx.persona as AuthPersona }
    : null;

  if (
    activeContext &&
    !memberships.some((m) => m.schoolId === activeContext!.schoolId)
  ) {
    activeContext = null;
  }

  if (!activeContext) {
    const def = pickDefaultMembership(memberships);
    if (def) {
      activeContext = { schoolId: def.schoolId, persona: def.persona };
    }
  }

  const isSchoolAdmin = memberships.some((m) => m.persona === "school_admin");
  const needsProfileCompletion = Boolean(
    person && person.profile_completed_at == null && !isSchoolAdmin,
  );

  return {
    success: true,
    data: {
      authUserId,
      personId: person?.id ?? null,
      profileCompletedAt: person?.profile_completed_at ?? null,
      email: person?.email ?? email,
      memberships,
      activeContext,
      needsProfileCompletion,
      isSchoolAdmin,
    },
  };
}

export async function listMyMembershipsAction() {
  const boot = await getAuthBootstrapAction();
  if (!boot.success) {
    return boot;
  }
  return { success: true as const, memberships: boot.data.memberships };
}

export async function setActiveContextAction(input: {
  schoolId: string;
  persona: string;
  membershipId?: string | null;
}): Promise<Result> {
  if (!isPersona(input.persona)) {
    return { success: false, error: "Invalid persona." };
  }

  // Prefer E29 switch (preferences + user_active_context dual-write)
  const switched = await switchActiveSchoolAction({
    schoolId: input.schoolId,
    membershipId: input.membershipId,
    persona: input.persona,
  });
  if (switched.success) {
    return switched;
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const authUserId = claimsData?.claims?.sub;
  if (typeof authUserId !== "string") {
    return { success: false, error: "You must be signed in." };
  }

  const memberships = await listMembershipsForUser(supabase, authUserId);
  const exact = memberships.some(
    (m) => m.schoolId === input.schoolId && m.persona === input.persona,
  );
  if (!exact) {
    return {
      success: false,
      error:
        switched.error ||
        "That school / persona is not in your memberships.",
    };
  }

  const { error } = await supabase.from("user_active_context").upsert(
    {
      auth_user_id: authUserId,
      school_id: input.schoolId,
      persona: input.persona,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "auth_user_id" },
  );

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
