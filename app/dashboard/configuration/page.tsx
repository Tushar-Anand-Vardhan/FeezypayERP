import { redirect } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { ConfigHubClient } from "@/components/configuration/config-hub-client";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { isTermCountLocked } from "@/lib/calendar/term-edit-guards";
import { buildConfigurationDashboard } from "@/lib/config-dashboard/health";
import { resolveConfigHubTab } from "@/lib/config-dashboard/hub-tabs";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function ConfigurationDashboardPage({
  searchParams,
}: PageProps) {
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
  const canEditCatalog = Boolean(
    headerAuth.authz?.permissions.includes("config.catalog.edit"),
  );
  const canEditCalendar = Boolean(
    headerAuth.authz?.permissions.includes("calendar.year.edit"),
  );

  const params = await searchParams;
  const activeTab = resolveConfigHubTab(params.tab);

  const { data: school } = await supabase
    .from("schools")
    .select(
      "name, code, onboarding_status, address_street, address_city, address_state, address_pincode, contact_phone, contact_email, board, affiliation_number, houses_enabled, clubs_enabled, logo_path",
    )
    .eq("id", schoolId)
    .maybeSingle();

  const onboardingComplete = school?.onboarding_status === "completed";
  const { summary, modules } = await buildConfigurationDashboard(
    supabase,
    schoolId,
  );

  const { data: year } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .is("archived_at", null)
    .maybeSingle();

  let academicYearId = year?.id ?? null;
  if (!academicYearId) {
    const { data: fallback } = await supabase
      .from("academic_years")
      .select("id")
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .order("label", { ascending: false })
      .limit(1)
      .maybeSingle();
    academicYearId = fallback?.id ?? null;
  }

  let terms: Array<{
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  }> = [];
  let termCountLocked = false;
  let lockReason: string | null = null;

  if (academicYearId) {
    const { data: termRows } = await supabase
      .from("terms")
      .select("id, name, start_date, end_date")
      .eq("academic_year_id", academicYearId)
      .is("archived_at", null)
      .order("start_date");
    terms = termRows ?? [];
    const lock = await isTermCountLocked(supabase, schoolId, academicYearId);
    termCountLocked = lock.locked;
    lockReason = lock.reason ?? null;
  }

  // Structure completeness
  const { count: classCount } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq(
      "academic_year_id",
      academicYearId ?? "00000000-0000-0000-0000-000000000000",
    )
    .is("archived_at", null);

  const { data: sections } = academicYearId
    ? await supabase
        .from("sections")
        .select("id, class_teacher_id, classes!inner(academic_year_id)")
        .eq("classes.academic_year_id", academicYearId)
        .is("archived_at", null)
    : { data: [] as Array<{ id: string; class_teacher_id: string | null }> };

  const sectionIds = (sections ?? []).map((s) => s.id);
  const withTeacher = (sections ?? []).filter((s) => s.class_teacher_id).length;

  let sectionsWithStudents = 0;
  if (sectionIds.length > 0) {
    const { data: placements } = await supabase
      .from("student_academic_years")
      .select("section_id")
      .in("section_id", sectionIds)
      .eq("status", "active")
      .is("left_on", null);
    sectionsWithStudents = new Set(
      (placements ?? []).map((p) => p.section_id),
    ).size;
  }

  let classesWithSubjects = 0;
  if (academicYearId) {
    const { data: offerRows } = await supabase
      .from("class_subjects")
      .select("class_id, classes!inner(academic_year_id)")
      .eq("classes.academic_year_id", academicYearId);
    classesWithSubjects = new Set(
      (offerRows ?? []).map((row) => row.class_id),
    ).size;
  }

  const structureItems = [
    {
      id: "classes",
      label: "Classes defined",
      ok: (classCount ?? 0) > 0,
      detail: `${classCount ?? 0} class(es) in the active year`,
    },
    {
      id: "subjects_offered",
      label: "Subjects offered to classes",
      ok: classesWithSubjects > 0,
      detail: `${classesWithSubjects} class(es) have subject offers`,
    },
    {
      id: "class_teachers",
      label: "Class teachers assigned",
      ok:
        sectionIds.length === 0
          ? false
          : withTeacher === sectionIds.length,
      detail: `${withTeacher}/${sectionIds.length} sections have a class teacher`,
    },
    {
      id: "students_placed",
      label: "Students placed in sections",
      ok:
        sectionIds.length === 0
          ? false
          : sectionsWithStudents === sectionIds.length,
      detail: `${sectionsWithStudents}/${sectionIds.length} sections have active students`,
    },
  ];

  const branding = {
    name: school?.name ?? "",
    code: school?.code ?? "",
    addressStreet: school?.address_street ?? "",
    addressCity: school?.address_city ?? "",
    addressState: school?.address_state ?? "",
    addressPincode: school?.address_pincode ?? "",
    contactPhone: school?.contact_phone ?? "",
    contactEmail: school?.contact_email ?? "",
    board: school?.board ?? "",
    affiliationNumber: school?.affiliation_number ?? "",
    housesEnabled: school?.houses_enabled ?? false,
    clubsEnabled: school?.clubs_enabled ?? false,
    logoPath: school?.logo_path ?? null,
  };

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
            Config hub
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Edit onboarding configuration after go-live. Outbound tabs open
            dedicated admin pages; Health keeps module readiness checks.
          </p>
        </header>
        <ConfigHubClient
          activeTab={activeTab}
          summary={summary}
          modules={modules}
          branding={branding}
          canEditCatalog={canEditCatalog}
          canEditCalendar={canEditCalendar}
          academicYearId={academicYearId}
          terms={terms}
          termCountLocked={termCountLocked}
          lockReason={lockReason}
          structureItems={structureItems}
        />
      </main>
    </div>
  );
}
