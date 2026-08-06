import { redirect } from "next/navigation";
import { getOnboardingProgress } from "@/lib/onboarding/progress";
import { DEFAULT_ONBOARDING_PATH } from "@/lib/onboarding/steps";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingIndexPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId =
    typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.school_id) {
    redirect(DEFAULT_ONBOARDING_PATH);
  }

  const progress = await getOnboardingProgress(supabase, profile.school_id);
  if ("error" in progress) {
    redirect(DEFAULT_ONBOARDING_PATH);
  }

  redirect(progress.nextHref);
}
