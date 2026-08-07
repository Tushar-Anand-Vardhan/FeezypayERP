import { redirect } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { HousesClubsAdminClient } from "@/components/houses-clubs/houses-clubs-admin-client";
import { createClient } from "@/lib/supabase/server";

export default async function HousesClubsDashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/login");
  }

  const userId =
    typeof claimsData.claims.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.school_id) {
    redirect("/dashboard");
  }

  const schoolId = profile.school_id;

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
      .select("id, label")
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
            Catalogues, colours, logos paths, teacher in charge, and year scope.
            Student captains and memberships are managed via membership APIs.
          </p>
        </header>
        <HousesClubsAdminClient
          houses={housesRes.data ?? []}
          clubs={clubsRes.data ?? []}
          employments={employments}
          years={(yearsRes.data ?? []).map((y) => ({
            id: y.id,
            label: y.label,
          }))}
          housesEnabled={school?.houses_enabled ?? false}
          clubsEnabled={school?.clubs_enabled ?? false}
        />
      </main>
    </div>
  );
}
