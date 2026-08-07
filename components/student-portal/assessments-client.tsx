type Row = {
  id: string;
  title: string;
  subject: string | null;
  marks: string | null;
  grade: string | null;
  publishedAt: string | null;
};

type Props = {
  rows: Row[];
};

export function StudentAssessmentsClient({ rows }: Props) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {rows.length === 0 ? (
        <li className="px-4 py-3 text-sm text-muted">
          No published results yet.
        </li>
      ) : (
        rows.map((r) => (
          <li key={r.id} className="px-4 py-3 text-sm">
            <span className="font-medium">{r.title}</span>
            <span className="text-muted">
              {r.subject ? ` · ${r.subject}` : ""}
              {r.marks != null ? ` · ${r.marks}` : ""}
              {r.grade ? ` · ${r.grade}` : ""}
              {r.publishedAt
                ? ` · ${new Date(r.publishedAt).toLocaleDateString()}`
                : ""}
            </span>
          </li>
        ))
      )}
    </ul>
  );
}
