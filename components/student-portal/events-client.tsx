type Row = {
  id: string;
  title: string;
  role: string | null;
  startsAt: string | null;
};

type Props = {
  rows: Row[];
};

export function StudentEventsClient({ rows }: Props) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {rows.length === 0 ? (
        <li className="px-4 py-3 text-sm text-muted">
          No event participations yet.
        </li>
      ) : (
        rows.map((r) => (
          <li key={r.id} className="px-4 py-3 text-sm">
            <span className="font-medium">{r.title}</span>
            <span className="text-muted">
              {r.role ? ` · ${r.role}` : ""}
              {r.startsAt
                ? ` · ${new Date(r.startsAt).toLocaleString()}`
                : ""}
            </span>
          </li>
        ))
      )}
    </ul>
  );
}
