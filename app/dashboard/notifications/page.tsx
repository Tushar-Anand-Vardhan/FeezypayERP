import { redirect } from "next/navigation";
import { NotificationsInboxClient } from "@/components/notifications/notifications-inbox-client";
import { requirePermission } from "@/lib/authz/require";
import { listNotificationHistoryAction } from "@/lib/notifications/query-actions";

export default async function NotificationsInboxPage() {
  const authzCtx = await requirePermission("communication.message.read");
  if ("error" in authzCtx) {
    redirect("/dashboard");
  }

  // Inbox only — do not flush outbox workers on every page load (that made this tab slow).
  const history = await listNotificationHistoryAction({
    limit: 50,
    mineOnly: false,
  });

  const rows = history.success
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
  );
}
