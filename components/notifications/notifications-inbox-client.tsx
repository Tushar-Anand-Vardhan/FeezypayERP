"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markNotificationReadAction } from "@/lib/notifications/query-actions";

type Row = {
  id: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  notification_type_code: string;
  created_at: string;
  sent_at: string | null;
  read_at: string | null;
};

export function NotificationsInboxClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        No notifications yet. Domain events enqueue here after the notify
        worker runs.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{row.title}</p>
            <p className="mt-1 text-sm text-muted">{row.body}</p>
            <p className="mt-2 text-xs text-muted">
              {row.notification_type_code} · {row.channel} · {row.status} ·{" "}
              {new Date(row.created_at).toLocaleString()}
            </p>
          </div>
          {row.status !== "read" ? (
            <button
              type="button"
              disabled={pending}
              className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-background disabled:opacity-50"
              onClick={() => {
                startTransition(async () => {
                  await markNotificationReadAction(row.id);
                  router.refresh();
                });
              }}
            >
              Mark read
            </button>
          ) : (
            <span className="shrink-0 text-xs text-muted">Read</span>
          )}
        </li>
      ))}
    </ul>
  );
}
