import { redirect } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  const email =
    typeof data.claims.email === "string" ? data.claims.email : "your account";

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <AppHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-feezy-indigo">
            Workspace
          </p>
          <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-3 text-sm text-muted">
            Signed in as{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </p>
          <p className="mt-6 text-sm text-muted">
            Your school foundation is ready. Next up: student data pipelines and
            AI insight reports for parents and counselors.
          </p>
        </div>
      </main>
    </div>
  );
}
