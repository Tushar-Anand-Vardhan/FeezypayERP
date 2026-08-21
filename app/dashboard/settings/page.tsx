import { redirect } from "next/navigation";
import { ResetOnboardingCard } from "@/components/dashboard/reset-onboarding-card";
import { requireAnyPermission } from "@/lib/authz/require";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsDashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/login");
  }

  const authzCtx = await requireAnyPermission([
    "tenant.school.edit",
    "onboarding.wizard.edit",
    "tenant.school.read",
  ]);
  if ("error" in authzCtx) {
    redirect("/dashboard");
  }

  const { data: school } = await supabase
    .from("schools")
    .select("name, onboarding_status")
    .eq("id", authzCtx.schoolId)
    .maybeSingle();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-feezy-indigo">
          System
        </p>
        <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          School-admin tools for {school?.name ?? "this school"}. Onboarding is{" "}
          {school?.onboarding_status === "completed" ? "complete" : "in progress"}
          .
        </p>
      </header>
      <ResetOnboardingCard />
    </main>
  );
}
