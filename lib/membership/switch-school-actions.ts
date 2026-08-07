"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDateEffective } from "@/lib/membership/validation";

type Result = { success: true } | { success: false; error: string };

export async function switchActiveSchoolAction(input: {
  schoolId: string;
  membershipId?: string | null;
  persona?: string | null;
}): Promise<Result> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const authUserId = claimsData?.claims?.sub;
  if (typeof authUserId !== "string") {
    return { success: false, error: "You must be signed in." };
  }

  const { data: person } = await supabase
    .from("persons")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!person?.id) {
    return { success: false, error: "No person bound to this account." };
  }

  const { data: memberships, error } = await supabase
    .from("school_memberships")
    .select(
      "id, school_id, status, school_persona, membership_kind, effective_from, effective_to",
    )
    .eq("person_id", person.id)
    .eq("school_id", input.schoolId)
    .is("archived_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  const candidates = (memberships ?? []).filter(
    (m) =>
      (m.status === "active" || m.status === "invited") &&
      isDateEffective(m.effective_from, m.effective_to),
  );

  const membership =
    (input.membershipId
      ? candidates.find((m) => m.id === input.membershipId)
      : null) ??
    (input.persona
      ? candidates.find((m) => m.school_persona === input.persona)
      : null) ??
    candidates[0] ??
    null;

  if (!membership) {
    return {
      success: false,
      error: "That school / membership is not available to switch to.",
    };
  }

  const persona =
    input.persona ??
    membership.school_persona ??
    membership.membership_kind;

  const { error: prefError } = await supabase
    .from("user_school_preferences")
    .upsert(
      {
        person_id: person.id,
        active_school_id: input.schoolId,
        active_membership_id: membership.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "person_id" },
    );

  if (prefError) {
    return { success: false, error: prefError.message };
  }

  const { error: ctxError } = await supabase.from("user_active_context").upsert(
    {
      auth_user_id: authUserId,
      school_id: input.schoolId,
      persona,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "auth_user_id" },
  );

  if (ctxError) {
    return { success: false, error: ctxError.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
