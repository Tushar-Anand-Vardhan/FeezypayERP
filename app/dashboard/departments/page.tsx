import { redirect } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { DepartmentsAdminClient } from "@/components/departments/departments-admin-client";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { createClient } from "@/lib/supabase/server";

export default async function DepartmentsDashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/login");
  }

  const authzCtx = await requirePermission("workforce.department.read");
  if ("error" in authzCtx) {
    redirect("/dashboard");
  }

  const schoolId = authzCtx.schoolId;
  const headerAuth = await getAppHeaderAuth();
  const canEdit = Boolean(
    headerAuth.authz?.permissions.includes("workforce.department.edit"),
  );

  const { data: school } = await supabase
    .from("schools")
    .select("name, onboarding_status")
    .eq("id", schoolId)
    .maybeSingle();

  const { data: departments } = await supabase
    .from("departments")
    .select(
      "id, name, code, description, parent_department_id, cost_center_code",
    )
    .eq("school_id", schoolId)
    .is("archived_at", null)
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
            Workforce
          </p>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            Departments
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Organisational units for HODs, teaching assignments, and department
            resources. Memberships are managed via department APIs.
          </p>
        </header>
        <DepartmentsAdminClient
          departments={departments ?? []}
          canEdit={canEdit}
        />
      </main>
    </div>
  );
}
