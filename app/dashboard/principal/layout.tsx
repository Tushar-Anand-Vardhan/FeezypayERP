import { redirect } from "next/navigation";
import { Suspense } from "react";
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

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Suspense fallback={null}>
        <PrincipalPortalNav authz={headerAuth.authz} />
      </Suspense>
      {children}
    </main>
  );
}
