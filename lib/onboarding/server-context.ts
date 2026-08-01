import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedSchoolContext():
  Promise<
    | { supabase: Awaited<ReturnType<typeof createClient>>; schoolId: string }
    | { error: string }
  > {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (typeof userId !== "string") {
    return { error: "You must be signed in to continue." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile?.school_id) {
    return { error: "We could not find your school profile." };
  }

  return { supabase, schoolId: profile.school_id };
}
