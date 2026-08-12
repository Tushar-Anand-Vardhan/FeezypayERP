import { redirect } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { AssessmentsAdminClient } from "@/components/assessment/assessments-admin-client";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { listExamDefinitionsAction } from "@/lib/assessment/exam-definitions-actions";
import { listAssessmentRubricsAction } from "@/lib/assessment/rubrics-actions";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ year?: string }>;
};

export default async function AssessmentsDashboardPage({
  searchParams,
}: PageProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/login");
  }

  const authzCtx = await requirePermission("assessment.config.read");
  if ("error" in authzCtx) {
    redirect("/dashboard");
  }

  const schoolId = authzCtx.schoolId;
  const headerAuth = await getAppHeaderAuth();
  const canEdit = Boolean(
    headerAuth.authz?.permissions.includes("assessment.config.edit"),
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

  const [examsRes, rubricsRes, subjectsRes, classesRes, periodsRes] =
    await Promise.all([
      listExamDefinitionsAction(academicYearId),
      listAssessmentRubricsAction(),
      supabase
        .from("subjects")
        .select("id, name")
        .eq("school_id", schoolId)
        .is("archived_at", null)
        .order("name"),
      supabase
        .from("classes")
        .select("id, name, sections(id, name)")
        .eq("academic_year_id", academicYearId)
        .order("display_order"),
      supabase
        .from("period_definitions")
        .select("id, period_number, start_time, end_time, name")
        .eq("academic_year_id", academicYearId)
        .order("period_number"),
    ]);

  const exams = examsRes.success
    ? (examsRes.exams as Array<Record<string, unknown>>).map((e) => ({
        id: String(e.id),
        name: String(e.name),
        publishing_status: String(e.publishing_status ?? "draft"),
        academic_year_id: String(e.academic_year_id),
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

  const periods = (periodsRes.data ?? []).map((p) => ({
    id: p.id,
    label: `P${p.period_number}${p.name ? ` · ${p.name}` : ""} (${p.start_time}–${p.end_time})`,
  }));

  const rubrics = rubricsRes.success ? rubricsRes.rubrics : [];

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
            Assessment
          </p>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            Exam schedules & rubrics
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Date subject sittings per class/section, set marking windows, attach
            periods or half/full-day kind, and build multi-criteria rubrics.
          </p>
        </header>
        <AssessmentsAdminClient
          years={years}
          academicYearId={academicYearId}
          exams={exams}
          subjects={(subjectsRes.data ?? []).map((s) => ({
            id: s.id,
            name: s.name,
          }))}
          classes={classes}
          periods={periods}
          rubrics={rubrics}
          canEdit={canEdit}
        />
      </main>
    </div>
  );
}
