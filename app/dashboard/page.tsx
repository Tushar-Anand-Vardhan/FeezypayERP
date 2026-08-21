import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { getOnboardingProgress } from "@/lib/onboarding/progress";
import { DEFAULT_ONBOARDING_PATH } from "@/lib/onboarding/steps";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  const userId =
    typeof data.claims.sub === "string" ? data.claims.sub : null;
  const email =
    typeof data.claims.email === "string" ? data.claims.email : "your account";

  let onboardingComplete = false;
  let onboardingResumeHref: string = DEFAULT_ONBOARDING_PATH;

  const headerAuth = await getAppHeaderAuth();
  const { activeSchoolId, authz } = headerAuth;

  const schoolIdForName =
    activeSchoolId ??
    (userId
      ? (
          await supabase
            .from("profiles")
            .select("school_id")
            .eq("id", userId)
            .maybeSingle()
        ).data?.school_id
      : null);

  if (schoolIdForName) {
    const { data: school } = await supabase
      .from("schools")
      .select("name, onboarding_status")
      .eq("id", schoolIdForName)
      .maybeSingle();

    onboardingComplete = school?.onboarding_status === "completed";

    if (!onboardingComplete && authz?.isSchoolAdmin) {
      const progress = await getOnboardingProgress(supabase, schoolIdForName);
      if (!("error" in progress)) {
        onboardingResumeHref = progress.nextHref;
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        {!onboardingComplete ? (
          <section className="rounded-2xl border border-feezy-magenta/20 bg-feezy-magenta/5 px-6 py-5 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-feezy-magenta">
              Setup in progress
            </p>
            <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
              Finish onboarding to unlock Feezypay
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Your workspace is ready to browse, but students, attendance,
              reports, and other features stay locked until school setup is
              complete.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={onboardingResumeHref}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-feezy-magenta px-5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Continue onboarding
              </Link>
              <Link
                href="/dashboard/settings"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-foreground transition hover:bg-surface-strong"
              >
                Settings / reset onboarding
              </Link>
            </div>
          </section>
        ) : null}

        <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-feezy-indigo">
            Overview
          </p>
          <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight">
            {onboardingComplete ? "Dashboard" : "Nothing here yet"}
          </h2>
          <p className="mt-3 max-w-md text-sm text-muted">
            Signed in as{" "}
            <span className="font-medium text-foreground">{email}</span>.
            {onboardingComplete
              ? " Your school workspace is ready."
              : " Complete onboarding to start seeing insights here."}
          </p>
        </section>
      </main>
  );
}
