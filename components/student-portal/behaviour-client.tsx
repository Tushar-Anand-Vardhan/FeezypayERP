type Row = {
  id: string;
  title: string;
  kind: string;
  visibility: string;
  recordedAt: string | null;
};

type Props = {
  rows: Row[];
};

export function StudentBehaviourClient({ rows }: Props) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {rows.length === 0 ? (
        <li className="px-4 py-3 text-sm text-muted">
          No remarks visible to you.
        </li>
      ) : (
        rows.map((r) => (
          <li key={r.id} className="px-4 py-3 text-sm">
            <span className="font-medium">{r.title}</span>
            <span className="text-muted">
              {" "}
              · {r.kind} · {r.visibility}
              {r.recordedAt
                ? ` · ${new Date(r.recordedAt).toLocaleString()}`
                : ""}
            </span>
          </li>
        ))
      )}
    </ul>
  );
}
