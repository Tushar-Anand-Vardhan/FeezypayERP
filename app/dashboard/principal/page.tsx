import { redirect } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { PrincipalDashboardClient } from "@/components/principal-dashboard/principal-dashboard-client";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { buildPrincipalDashboard } from "@/lib/principal-dashboard/dashboard";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ date?: string; year?: string }>;
};

export default async function PrincipalDashboardPage({
  searchParams,
}: PageProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/login");
  }

  const authzCtx = await requirePermission("analytics.dashboard.read");
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
  const params = await searchParams;

  const dashboard = await buildPrincipalDashboard(
    supabase,
    schoolId,
    school?.name ?? null,
    {
      asOfDate: params.date,
      academicYearId: params.year,
    },
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      <AppHeader
        schoolName={school?.name}
        onboardingComplete={onboardingComplete}
        memberships={headerAuth.memberships}
        activeSchoolId={headerAuth.activeSchoolId}
        activePersona={headerAuth.activePersona}
        authz={headerAuth.authz}
      />
      <PrincipalDashboardClient dashboard={dashboard} />
    </div>
  );
}
