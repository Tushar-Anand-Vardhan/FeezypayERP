import { redirect } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { HousesClubsAdminClient } from "@/components/houses-clubs/houses-clubs-admin-client";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { listStudentsWithoutHouseAction } from "@/lib/houses-clubs/house-memberships-actions";
import { createClient } from "@/lib/supabase/server";

export default async function HousesClubsDashboardPage() {
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
  const canEditMemberships = Boolean(
    headerAuth.authz?.permissions.includes("config.catalog.edit"),
  );

  const { data: school } = await supabase
    .from("schools")
    .select("name, onboarding_status, houses_enabled, clubs_enabled")
    .eq("id", schoolId)
    .maybeSingle();

  const onboardingComplete = school?.onboarding_status === "completed";

  const [housesRes, clubsRes, yearsRes, employmentsRes] = await Promise.all([
    supabase
      .from("houses")
      .select(
        "id, name, code, description, colour, logo_path, teacher_in_charge_employment_id, academic_year_id",
      )
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .order("display_order", { ascending: true }),
    supabase
      .from("clubs")
      .select(
        "id, name, code, description, colour, logo_path, teacher_in_charge_employment_id, academic_year_id",
      )
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .order("display_order", { ascending: true }),
    supabase
      .from("academic_years")
      .select("id, label, is_active")
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .order("label", { ascending: false }),
    supabase
      .from("teacher_employments")
      .select(
        "id, teacher_profiles(persons(full_name))",
      )
      .eq("school_id", schoolId)
      .eq("status", "active"),
  ]);

  const years = (yearsRes.data ?? []).map((y) => ({
    id: y.id,
    label: y.label,
    isActive: Boolean(y.is_active),
  }));
  const academicYearId =
    years.find((y) => y.isActive)?.id ?? years[0]?.id ?? null;

  let unassigned: Array<{
    admissionId: string;
    studentProfileId: string;
    fullName: string;
    admissionNumber: string | null;
    className: string | null;
    sectionName: string | null;
  }> = [];
  if (school?.houses_enabled && academicYearId) {
    const listed = await listStudentsWithoutHouseAction(academicYearId);
    if (listed.success) {
      unassigned = listed.unassigned;
    }
  }

  const employments = (employmentsRes.data ?? []).map((row) => {
    const profileRel = row.teacher_profiles as
      | { persons?: { full_name?: string } | null }
      | { persons?: { full_name?: string } | null }[]
      | null;
    const person = Array.isArray(profileRel)
      ? profileRel[0]?.persons
      : profileRel?.persons;
    return {
      id: row.id,
      label: person?.full_name ?? "Teacher",
    };
  });

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
            Houses & clubs
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Catalogues, colours, teacher in charge, and house membership CSV
            import. Unassigned students flash when houses are enabled.
          </p>
        </header>
        <HousesClubsAdminClient
          houses={housesRes.data ?? []}
          clubs={clubsRes.data ?? []}
          employments={employments}
          years={years.map((y) => ({ id: y.id, label: y.label }))}
          housesEnabled={school?.houses_enabled ?? false}
          clubsEnabled={school?.clubs_enabled ?? false}
          canEditMemberships={canEditMemberships}
          academicYearId={academicYearId}
          unassigned={unassigned}
        />
      </main>
    </div>
  );
}
