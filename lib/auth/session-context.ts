"use server";

import { revalidatePath } from "next/cache";
import { cache } from "react";
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

const getAuthBootstrapCached = cache(async (): Promise<
  { success: true; data: AuthBootstrap } | { success: false; error: string }
> => {
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

  // Parallel core reads. Only run ensure-admin when the RPC list has no admin
  // membership yet (rare after first login).
  const [personRes, memberships, ctxRes] = await Promise.all([
    supabase
      .from("persons")
      .select("id, profile_completed_at, email")
      .eq("auth_user_id", authUserId)
      .maybeSingle(),
    listMembershipsForUser(supabase, authUserId),
    supabase
      .from("user_active_context")
      .select("school_id, persona")
      .eq("auth_user_id", authUserId)
      .maybeSingle(),
  ]);

  const person = personRes.data;
  let nextMemberships = memberships;

  if (!nextMemberships.some((m) => m.persona === "school_admin")) {
    await ensureAdminMembershipIndexed(supabase, authUserId);
    nextMemberships = await listMembershipsForUser(supabase, authUserId);
  }

  const schoolIds = [...new Set(nextMemberships.map((m) => m.schoolId))];
  const schoolNamesPromise =
    schoolIds.length > 0
      ? supabase.from("schools").select("id, name").in("id", schoolIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> });

  const indexedPromise = person?.id
    ? supabase
        .from("school_memberships")
        .select("id, source_type, source_id")
        .eq("person_id", person.id)
        .is("archived_at", null)
    : Promise.resolve({ data: [] as Array<{ id: string; source_type: string; source_id: string }> });

  const [schoolsRes, indexedRes] = await Promise.all([
    schoolNamesPromise,
    indexedPromise,
  ]);

  const nameById = new Map((schoolsRes.data ?? []).map((s) => [s.id, s.name]));
  for (const m of nextMemberships) {
    m.schoolName = nameById.get(m.schoolId) ?? null;
  }

  if (person?.id) {
    const bySource = new Map(
      (indexedRes.data ?? []).map((r) => [`${r.source_type}:${r.source_id}`, r.id]),
    );
    for (const m of nextMemberships) {
      m.membershipId = bySource.get(`${m.source}:${m.sourceId}`) ?? null;
    }
  }

  const ctx = ctxRes.data;

  let activeContext = ctx
    ? { schoolId: ctx.school_id as string, persona: ctx.persona as AuthPersona }
    : null;

  if (
    activeContext &&
    !nextMemberships.some((m) => m.schoolId === activeContext!.schoolId)
  ) {
    activeContext = null;
  }

  if (!activeContext) {
    const def = pickDefaultMembership(nextMemberships);
    if (def) {
      activeContext = { schoolId: def.schoolId, persona: def.persona };
    }
  }

  const isSchoolAdmin = nextMemberships.some((m) => m.persona === "school_admin");
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
      memberships: nextMemberships,
      activeContext,
      needsProfileCompletion,
      isSchoolAdmin,
    },
  };
});

export async function getAuthBootstrapAction(): Promise<
  { success: true; data: AuthBootstrap } | { success: false; error: string }
> {
  return getAuthBootstrapCached();
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
