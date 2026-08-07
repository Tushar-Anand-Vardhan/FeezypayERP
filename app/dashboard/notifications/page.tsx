import { redirect } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { NotificationsInboxClient } from "@/components/notifications/notifications-inbox-client";
import { getAppHeaderAuth } from "@/lib/authz/bootstrap";
import { requirePermission } from "@/lib/authz/require";
import { processDomainEventOutbox } from "@/lib/notifications/process-domain-outbox";
import { processNotificationOutbox } from "@/lib/notifications/worker";
import { listNotificationHistoryAction } from "@/lib/notifications/query-actions";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsInboxPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/login");
  }

  const authzCtx = await requirePermission("communication.message.read");
  if ("error" in authzCtx) {
    redirect("/dashboard");
  }

  // Flush pending domain + delivery outbox so inbox stays fresh without cron
  await processDomainEventOutbox(authzCtx.supabase, { limit: 30 });
  await processNotificationOutbox(authzCtx.supabase, { limit: 50 });

  const headerAuth = await getAppHeaderAuth();
  const history = await listNotificationHistoryAction({
    limit: 50,
    mineOnly: false,
  });

  const { data: school } = await supabase
    .from("schools")
    .select("name, onboarding_status")
    .eq("id", authzCtx.schoolId)
    .maybeSingle();

  const rows =
    history.success
      ? (history.rows as Array<{
          id: string;
          title: string;
          body: string;
          channel: string;
          status: string;
          notification_type_code: string;
          created_at: string;
          sent_at: string | null;
          read_at: string | null;
        }>)
      : [];

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
            Notifications
          </p>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            Delivery inbox
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            School delivery requests from domain events and announcements.
            External channels stay stub-safe until provider keys are configured.
          </p>
        </header>
        {!history.success ? (
          <p className="text-sm text-feezy-magenta">{history.error}</p>
        ) : (
          <NotificationsInboxClient rows={rows} />
        )}
      </main>
    </div>
  );
}
