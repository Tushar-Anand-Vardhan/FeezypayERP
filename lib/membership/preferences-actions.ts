"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { success: true } | { success: false; error: string };

export async function setDefaultSchoolAction(input: {
  schoolId: string;
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

  const { data: membership } = await supabase
    .from("school_memberships")
    .select("id")
    .eq("person_id", person.id)
    .eq("school_id", input.schoolId)
    .in("status", ["active", "invited"])
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return {
      success: false,
      error: "Default school must be one of your active memberships.",
    };
  }

  const { error } = await supabase.from("user_school_preferences").upsert(
    {
      person_id: person.id,
      default_school_id: input.schoolId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "person_id" },
  );

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
