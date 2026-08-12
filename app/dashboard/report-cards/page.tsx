import { redirect } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { ReportCardsDesignerClient } from "@/components/report-cards/template-designer-client";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { listReportCardTemplatesAction } from "@/lib/report-cards/templates-actions";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ year?: string }>;
};

export default async function ReportCardsDashboardPage({
  searchParams,
}: PageProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/login");
  }

  const authzCtx = await requirePermission("document.template.edit");
  if ("error" in authzCtx) {
    // Allow read-only viewers with report_card.read to land elsewhere
    const readOnly = await requirePermission("document.report_card.read");
    if ("error" in readOnly) {
      redirect("/dashboard");
    }
    redirect("/dashboard/student/report-cards");
  }

  const schoolId = authzCtx.schoolId;
  const headerAuth = await getAppHeaderAuth();
  const canEdit = Boolean(
    headerAuth.authz?.permissions.includes("document.template.edit"),
  );

  const { data: school } = await supabase
    .from("schools")
    .select("name, onboarding_status")
    .eq("id", schoolId)
    .maybeSingle();

  const params = await searchParams;
  const { data: yearsRaw } = await supabase
    .from("academic_years")
    .select("id, label, is_active")
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .order("label", { ascending: false });

  const years = (yearsRaw ?? []).map((y) => ({
    id: y.id,
    label: y.label,
    isActive: Boolean(y.is_active),
  }));

  const academicYearId =
    params.year && years.some((y) => y.id === params.year)
      ? params.year
      : (years.find((y) => y.isActive)?.id ?? years[0]?.id ?? "");

  if (!academicYearId) {
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
        <main className="mx-auto w-full max-w-6xl px-4 py-10">
          <p className="text-sm text-muted">No academic year configured.</p>
        </main>
      </div>
    );
  }

  const [templatesRes, classesRes] = await Promise.all([
    listReportCardTemplatesAction({ academicYearId }),
    supabase
      .from("classes")
      .select("id, name, sections(id, name)")
      .eq("academic_year_id", academicYearId)
      .order("display_order"),
  ]);

  const templates = templatesRes.success
    ? (templatesRes.templates as Array<Record<string, unknown>>).map((t) => ({
        id: String(t.id),
        code: String(t.code ?? ""),
        name: String(t.name),
        status: String(t.status ?? "draft"),
        academic_year_id: (t.academic_year_id as string | null) ?? null,
        include_grades: Boolean(t.include_grades),
        include_attendance: Boolean(t.include_attendance),
        include_behaviour: Boolean(t.include_behaviour),
        include_remarks: Boolean(t.include_remarks),
      }))
    : [];

  const classes = (classesRes.data ?? []).map((c) => {
    const secs = Array.isArray(c.sections)
      ? c.sections
      : c.sections
        ? [c.sections]
        : [];
    return {
      id: c.id,
      name: c.name,
      sections: (secs as Array<{ id: string; name: string }>).map((s) => ({
        id: s.id,
        name: s.name,
      })),
    };
  });

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
            Documents
          </p>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            Report card designer
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Draft templates, scope them to classes/sections, publish when ready.
            Issue/PDF remains on the report-card engine issue path.
          </p>
        </header>
        <ReportCardsDesignerClient
          years={years}
          academicYearId={academicYearId}
          templates={templates}
          classes={classes}
          canEdit={canEdit}
        />
      </main>
    </div>
  );
}
