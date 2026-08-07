type Row = {
  id: string;
  title: string;
  status: string;
  issuedAt: string | null;
};

type Props = {
  rows: Row[];
};

export function StudentReportCardsClient({ rows }: Props) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {rows.length === 0 ? (
        <li className="px-4 py-3 text-sm text-muted">No report cards issued.</li>
      ) : (
        rows.map((r) => (
          <li key={r.id} className="px-4 py-3 text-sm">
            <span className="font-medium">{r.title}</span>
            <span className="text-muted">
              {" "}
              · {r.status}
              {r.issuedAt
                ? ` · ${new Date(r.issuedAt).toLocaleDateString()}`
                : ""}
            </span>
          </li>
        ))
      )}
    </ul>
  );
}
