import { redirect } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { ConfigurationDashboardClient } from "@/components/configuration/configuration-dashboard-client";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { buildConfigurationDashboard } from "@/lib/config-dashboard/health";
import { createClient } from "@/lib/supabase/server";

export default async function ConfigurationDashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/login");
  }

  const authzCtx = await requirePermission("config.catalog.read");
  if ("error" in authzCtx) {
    redirect("/dashboard");
  }

  const schoolId = authzCtx.schoolId;
  const headerAuth = await getAppHeaderAuth();

  const { data: school } = await supabase
    .from("schools")
    .select("name, onboarding_status")
    .eq("id", schoolId)
    .maybeSingle();

  const onboardingComplete = school?.onboarding_status === "completed";
  const { summary, modules } = await buildConfigurationDashboard(
    supabase,
    schoolId,
  );

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <AppHeader
        schoolName={school?.name ?? null}
        onboardingComplete={onboardingComplete}
        memberships={headerAuth.memberships}
        activeSchoolId={headerAuth.activeSchoolId}
        activePersona={headerAuth.activePersona}
        authz={headerAuth.authz}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-feezy-indigo">
            Configuration
          </p>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            School setup command centre
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Completion, warnings, missing configuration, dependency errors, and
            health checks across every configuration module.
          </p>
        </header>
        <ConfigurationDashboardClient summary={summary} modules={modules} />
      </main>
    </div>
  );
}
