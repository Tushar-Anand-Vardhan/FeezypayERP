import { redirect } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { TimetableAdminClient } from "@/components/timetable/timetable-admin-client";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ year?: string }>;
};

export default async function TimetableDashboardPage({
  searchParams,
}: PageProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/login");
  }

  const authzCtx = await requirePermission("timetable.grid.read");
  if ("error" in authzCtx) {
    redirect("/dashboard");
  }

  const schoolId = authzCtx.schoolId;
  const headerAuth = await getAppHeaderAuth();
  const canEdit = Boolean(
    headerAuth.authz?.permissions.includes("timetable.grid.edit"),
  );
  const params = await searchParams;

  const { data: school } = await supabase
    .from("schools")
    .select("name, onboarding_status")
    .eq("id", schoolId)
    .maybeSingle();

  const { data: yearsRaw } = await supabase
    .from("academic_years")
    .select("id, label, is_active")
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .order("label", { ascending: false });

  const years = yearsRaw ?? [];
  const selectedYearId =
    params.year && years.some((y) => y.id === params.year)
      ? params.year
      : (years.find((y) => y.is_active)?.id ?? years[0]?.id ?? null);

  let periods: Array<{
    id: string;
    period_number: number;
    start_time: string;
    end_time: string;
    name: string | null;
    is_break: boolean;
    is_locked: boolean;
  }> = [];
  let grids: Array<{
    id: string;
    name: string;
    grid_type: string;
    cycle_length: number;
    is_active: boolean;
    effective_from: string | null;
    effective_to: string | null;
  }> = [];

  if (selectedYearId) {
    const [periodsRes, gridsRes] = await Promise.all([
      supabase
        .from("period_definitions")
        .select(
          "id, period_number, start_time, end_time, name, is_break, is_locked",
        )
        .eq("academic_year_id", selectedYearId)
        .is("archived_at", null)
        .order("period_number"),
      supabase
        .from("timetable_grids")
        .select(
          "id, name, grid_type, cycle_length, is_active, effective_from, effective_to",
        )
        .eq("school_id", schoolId)
        .eq("academic_year_id", selectedYearId)
        .is("archived_at", null)
        .order("name"),
    ]);
    periods = periodsRes.data ?? [];
    grids = gridsRes.data ?? [];
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <AppHeader
        schoolName={school?.name ?? null}
        onboardingComplete={school?.onboarding_status === "completed"}
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
            Timetable
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Period bells and cycle grids for each academic year. Activate a
            primary grid when the school week should follow it.
          </p>
        </header>
        <TimetableAdminClient
          years={years}
          selectedYearId={selectedYearId}
          periods={periods}
          grids={grids}
          canEdit={canEdit}
        />
      </main>
    </div>
  );
}
