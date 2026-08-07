"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result =
  | { success: true; redirectTo: string }
  | { success: false; error: string };

/**
 * First-login profile completion: sets profile_completed_at and activates invited employments.
 */
export async function completeProfileAction(input: {
  phone?: string | null;
  fullName?: string | null;
}): Promise<Result> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { success: false, error: "You must be signed in." };
  }

  const { data: person, error: personError } = await supabase
    .from("persons")
    .select("id, profile_completed_at, full_name, phone")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (personError || !person) {
    return {
      success: false,
      error: "No person linked to this account. Accept your invite first.",
    };
  }

  const updates: Record<string, unknown> = {
    profile_completed_at: new Date().toISOString(),
  };
  if (input.fullName?.trim()) {
    updates.full_name = input.fullName.trim();
  }
  if (input.phone !== undefined) {
    updates.phone = input.phone?.trim() || null;
  }

  const { error: updError } = await supabase
    .from("persons")
    .update(updates)
    .eq("id", person.id);

  if (updError) {
    return { success: false, error: updError.message };
  }

  // Activate invited employments for this person
  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("person_id", person.id)
    .maybeSingle();

  if (teacherProfile) {
    const { data: activated } = await supabase
      .from("teacher_employments")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("teacher_profile_id", teacherProfile.id)
      .eq("status", "invited")
      .select("id");

    const { syncStaffMembership } = await import("@/lib/membership/sync");
    for (const row of activated ?? []) {
      await syncStaffMembership(supabase, row.id);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/activate/profile");
  return { success: true, redirectTo: "/dashboard" };
}
