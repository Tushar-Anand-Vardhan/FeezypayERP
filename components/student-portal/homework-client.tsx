type Row = {
  id: string;
  title: string;
  dueOn: string | null;
  status: string;
  submissionStatus: string | null;
};

type Props = {
  rows: Row[];
};

export function StudentHomeworkClient({ rows }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Read-only view. Self-submit is not enabled in this portal version.
      </p>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {rows.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">No homework assigned.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              <span className="font-medium">{r.title}</span>
              <span className="text-muted">
                {r.dueOn ? ` · due ${r.dueOn}` : ""}
                {` · ${r.status}`}
                {r.submissionStatus
                  ? ` · submission: ${r.submissionStatus}`
                  : " · not submitted"}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
