import { redirect } from "next/navigation";
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
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-foreground/10 bg-background p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-3 text-sm text-foreground/70">
          You&apos;re signed in as{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </p>
        <p className="mt-6 text-xs text-foreground/50">
          Placeholder — school onboarding and roles come next.
        </p>
      </div>
    </main>
  );
}
