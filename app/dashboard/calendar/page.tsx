import { redirect } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { CalendarAdminClient } from "@/components/calendar/calendar-admin-client";
import { createClient } from "@/lib/supabase/server";
import type { AcademicYearStatus } from "@/lib/calendar/types";

type PageProps = {
  searchParams: Promise<{ year?: string }>;
};

export default async function CalendarDashboardPage({ searchParams }: PageProps) {
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
  const params = await searchParams;

  const { data: school } = await supabase
    .from("schools")
    .select("name, onboarding_status")
    .eq("id", schoolId)
    .maybeSingle();

  const onboardingComplete = school?.onboarding_status === "completed";

  const { data: yearsRaw } = await supabase
    .from("academic_years")
    .select("id, label, is_active, status, start_date, end_date")
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .order("label", { ascending: false });

  const years = (yearsRaw ?? []).map((y) => ({
    ...y,
    status: (y.status ?? "active") as AcademicYearStatus,
  }));

  const selectedYearId =
    params.year && years.some((y) => y.id === params.year)
      ? params.year
      : (years.find((y) => y.is_active)?.id ?? years[0]?.id ?? null);

  let terms: Array<{
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  }> = [];
  let holidays: Array<{
    id: string;
    title: string;
    start_date: string;
    end_date: string;
  }> = [];
  let events: Array<{
    id: string;
    title: string;
    category: string;
    starts_at: string;
    ends_at: string;
    approval_status: string;
    location: string | null;
  }> = [];
  let workingDays = {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  };

  if (selectedYearId) {
    const [termsRes, holidaysRes, eventsRes, patternRes] = await Promise.all([
      supabase
        .from("terms")
        .select("id, name, start_date, end_date")
        .eq("academic_year_id", selectedYearId)
        .is("archived_at", null)
        .order("start_date", { ascending: true }),
      supabase
        .from("holidays")
        .select("id, title, start_date, end_date")
        .eq("school_id", schoolId)
        .eq("academic_year_id", selectedYearId)
        .is("archived_at", null)
        .order("start_date", { ascending: true }),
      supabase
        .from("calendar_events")
        .select(
          "id, title, category, starts_at, ends_at, approval_status, location",
        )
        .eq("school_id", schoolId)
        .eq("academic_year_id", selectedYearId)
        .is("archived_at", null)
        .order("starts_at", { ascending: true }),
      supabase
        .from("school_working_day_patterns")
        .select(
          "monday, tuesday, wednesday, thursday, friday, saturday, sunday",
        )
        .eq("school_id", schoolId)
        .eq("academic_year_id", selectedYearId)
        .maybeSingle(),
    ]);

    terms = termsRes.data ?? [];
    holidays = holidaysRes.data ?? [];
    events = eventsRes.data ?? [];
    if (patternRes.data) {
      workingDays = patternRes.data;
    } else {
      const { data: defaultPattern } = await supabase
        .from("school_working_day_patterns")
        .select(
          "monday, tuesday, wednesday, thursday, friday, saturday, sunday",
        )
        .eq("school_id", schoolId)
        .is("academic_year_id", null)
        .maybeSingle();
      if (defaultPattern) {
        workingDays = defaultPattern;
      }
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <AppHeader
        schoolName={school?.name ?? null}
        onboardingComplete={onboardingComplete}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-feezy-indigo">
            Calendar
          </p>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            Academic calendar
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Years, terms, working days, holidays, and school events. Holidays
            are non-instructional days; events are occasions (PTM, sports,
            trips).
          </p>
        </header>
        <CalendarAdminClient
          years={years}
          selectedYearId={selectedYearId}
          terms={terms}
          holidays={holidays}
          events={events}
          workingDays={workingDays}
        />
      </main>
    </div>
  );
}
