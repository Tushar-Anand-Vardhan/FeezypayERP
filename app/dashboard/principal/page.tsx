import { redirect } from "next/navigation";
import { PrincipalDashboardClient } from "@/components/principal-dashboard/principal-dashboard-client";
import { requirePermission } from "@/lib/authz/require";
import { buildPrincipalDashboard } from "@/lib/principal-dashboard/dashboard";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ date?: string; year?: string }>;
};

export default async function PrincipalDashboardPage({
  searchParams,
}: PageProps) {
  const authzCtx = await requirePermission("analytics.dashboard.read");
  if ("error" in authzCtx) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const schoolId = authzCtx.schoolId;
  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();

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
    <>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-feezy-indigo">
          Principal
        </p>
        <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
          Overview
        </h1>
        <p className="mt-2 text-sm text-muted">
          Morning ops review (WF-PRI-01). Teachers, promote, and withdraw live
          in the tabs above.
        </p>
      </header>
      <PrincipalDashboardClient dashboard={dashboard} />
    </>
  );
}
