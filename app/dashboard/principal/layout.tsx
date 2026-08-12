import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/dashboard/app-header";
import { PrincipalPortalNav } from "@/components/principal-portal/principal-portal-nav";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { createClient } from "@/lib/supabase/server";

export default async function PrincipalPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/login");
  }

  const authzCtx = await requirePermission("analytics.dashboard.read");
  if ("error" in authzCtx) {
    redirect("/dashboard");
  }

  const headerAuth = await getAppHeaderAuth();
  const { data: school } = await supabase
    .from("schools")
    .select("name, onboarding_status")
    .eq("id", authzCtx.schoolId)
    .maybeSingle();

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
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <Suspense fallback={null}>
          <PrincipalPortalNav authz={headerAuth.authz} />
        </Suspense>
        {children}
      </main>
    </div>
  );
}
