"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";

export type PlatformResult =
  | { success: true; message?: string }
  | { success: false; error: string };

async function requirePlatformOperator(): Promise<
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      personId: string;
      authUserId: string;
      canImpersonate: boolean;
    }
  | { error: string }
> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "You must be signed in." };
  }

  const { data: person } = await supabase
    .from("persons")
    .select("id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (!person) {
    return { error: "Person not found." };
  }

  const { data: op } = await supabase
    .from("platform_operators")
    .select("id, can_impersonate")
    .eq("person_id", person.id)
    .is("archived_at", null)
    .maybeSingle();

  if (!op) {
    return { error: "Not a platform operator." };
  }

  return {
    supabase,
    personId: person.id,
    authUserId: userData.user.id,
    canImpersonate: Boolean(op.can_impersonate),
  };
}

export async function listPlatformSchoolsAction(): Promise<
  | {
      success: true;
      schools: Array<{
        id: string;
        name: string;
        code: string | null;
        onboardingStatus: string | null;
        board: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const op = await requirePlatformOperator();
  if ("error" in op) {
    return { success: false, error: op.error };
  }

  if (!hasServiceRoleKey()) {
    return {
      success: false,
      error: "Service role key required for cross-tenant school list.",
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("schools")
    .select("id, name, code, onboarding_status, board")
    .order("name")
    .limit(200);

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    schools: (data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      onboardingStatus: s.onboarding_status,
      board: s.board,
    })),
  };
}

/** Break-glass: switch active school context to a tenant (persona school_admin). */
export async function impersonateSchoolContextAction(input: {
  schoolId: string;
}): Promise<PlatformResult> {
  const op = await requirePlatformOperator();
  if ("error" in op) {
    return { success: false, error: op.error };
  }
  if (!op.canImpersonate) {
    return {
      success: false,
      error: "Impersonation not enabled for this operator.",
    };
  }

  if (!hasServiceRoleKey()) {
    return { success: false, error: "Service role key required." };
  }

  const admin = createAdminClient();
  const { data: school } = await admin
    .from("schools")
    .select("id, name")
    .eq("id", input.schoolId)
    .maybeSingle();
  if (!school) {
    return { success: false, error: "School not found." };
  }

  const { error: ctxError } = await admin.from("user_active_context").upsert(
    {
      auth_user_id: op.authUserId,
      school_id: school.id,
      persona: "school_admin",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "auth_user_id" },
  );

  if (ctxError) {
    return { success: false, error: ctxError.message };
  }

  // Ensure profiles.school_id points at target for RLS helpers that still use it
  await admin
    .from("profiles")
    .update({ school_id: school.id, role: "school_admin" })
    .eq("id", op.authUserId);

  await op.supabase.from("platform_audit_log").insert({
    operator_person_id: op.personId,
    action: "impersonate_school",
    school_id: school.id,
    detail: { school_name: school.name },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/platform");
  return {
    success: true,
    message: `Switched context to ${school.name}.`,
  };
}

export async function isPlatformOperatorAction(): Promise<{
  success: true;
  isOperator: boolean;
  canImpersonate: boolean;
}> {
  const op = await requirePlatformOperator();
  if ("error" in op) {
    return { success: true, isOperator: false, canImpersonate: false };
  }
  return {
    success: true,
    isOperator: true,
    canImpersonate: op.canImpersonate,
  };
}
