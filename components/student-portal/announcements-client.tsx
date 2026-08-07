type Row = {
  id: string;
  title: string;
  kind: string;
  publishedAt: string | null;
  source: string;
};

type Props = {
  rows: Row[];
};

export function StudentAnnouncementsClient({ rows }: Props) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {rows.length === 0 ? (
        <li className="px-4 py-3 text-sm text-muted">
          No announcements for you yet.
        </li>
      ) : (
        rows.map((r) => (
          <li key={r.id} className="px-4 py-3 text-sm">
            <span className="font-medium">{r.title}</span>
            <span className="text-muted">
              {" "}
              · {r.source}
              {r.kind ? ` · ${r.kind}` : ""}
              {r.publishedAt
                ? ` · ${new Date(r.publishedAt).toLocaleString()}`
                : ""}
            </span>
          </li>
        ))
      )}
    </ul>
  );
}
