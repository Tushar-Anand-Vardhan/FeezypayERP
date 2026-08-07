import Link from "next/link";

type ModuleCard = {
  href: string;
  label: string;
  summary: string;
};

type Props = {
  displayName: string | null;
  isPreview: boolean;
  cards: ModuleCard[];
  notifications: Array<{ id: string; title: string; createdAt: string | null }>;
};

export function StudentHomeClient({
  displayName,
  isPreview,
  cards,
  notifications,
}: Props) {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {displayName ? `Hello, ${displayName}` : "Student home"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your school day at a glance
          {isPreview ? " (staff preview)" : ""}.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-border bg-surface p-4 transition hover:border-feezy-indigo/40"
          >
            <h2 className="text-sm font-semibold">{c.label}</h2>
            <p className="mt-1 text-sm text-muted">{c.summary}</p>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-semibold">Recent notifications</h2>
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
          {notifications.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No notifications yet.</li>
          ) : (
            notifications.map((n) => (
              <li key={n.id} className="px-4 py-3 text-sm">
                <span className="font-medium">{n.title}</span>
                {n.createdAt ? (
                  <span className="text-muted">
                    {" "}
                    · {new Date(n.createdAt).toLocaleString()}
                  </span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
