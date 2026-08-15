import { redirect } from "next/navigation";
import { PlatformConsoleClient } from "@/components/platform/platform-console-client";
import {
  isPlatformOperatorAction,
  listPlatformSchoolsAction,
} from "@/lib/platform/platform-actions";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformConsolePage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/login");
  }

  const op = await isPlatformOperatorAction();
  if (!op.isOperator) {
    redirect("/dashboard");
  }

  const listed = await listPlatformSchoolsAction();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-feezy-indigo">
            Platform
          </p>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            Super-admin console
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Cross-org school health. Operators are seeded in{" "}
            <code className="text-xs">platform_operators</code>.
          </p>
        </header>
        {listed.success ? (
          <PlatformConsoleClient
            schools={listed.schools}
            canImpersonate={op.canImpersonate}
          />
        ) : (
          <p className="text-sm text-red-700">{listed.error}</p>
        )}
      </main>
  );
}
