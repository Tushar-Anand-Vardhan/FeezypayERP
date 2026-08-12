import { redirect } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { SubjectsAdminClient } from "@/components/subjects/subjects-admin-client";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { createClient } from "@/lib/supabase/server";

export default async function SubjectsDashboardPage() {
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
  const canEdit = Boolean(
    headerAuth.authz?.permissions.includes("config.catalog.edit"),
  );

  const { data: school } = await supabase
    .from("schools")
    .select("name, onboarding_status")
    .eq("id", schoolId)
    .maybeSingle();

  const { data: subjects } = await supabase
    .from("subjects")
    .select(
      "id, name, code, category, type, is_language, is_elective, weekly_periods, requires_lab, board_code",
    )
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

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
            Subjects
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Subject master for the school — categories, language/elective flags,
            and weekly periods. Class offers and dependencies stay in the
            subject configuration APIs.
          </p>
        </header>
        <SubjectsAdminClient subjects={subjects ?? []} canEdit={canEdit} />
      </main>
    </div>
  );
}
