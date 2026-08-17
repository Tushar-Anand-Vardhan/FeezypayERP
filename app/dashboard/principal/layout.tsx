import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PrincipalPortalNav } from "@/components/principal-portal/principal-portal-nav";
import { authzBootstrapFromActor } from "@/lib/authz/bootstrap-shared";
import { requirePermission } from "@/lib/authz/require";

export default async function PrincipalPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authzCtx = await requirePermission("analytics.dashboard.read");
  if ("error" in authzCtx) {
    redirect("/dashboard");
  }

  const authz = authzBootstrapFromActor(authzCtx.actor);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Suspense fallback={null}>
        <PrincipalPortalNav authz={authz} />
      </Suspense>
      {children}
    </main>
  );
}
