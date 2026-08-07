type Row = {
  id: string;
  date: string;
  status: string;
  sessionLabel: string | null;
};

type Props = {
  records: Row[];
};

export function StudentAttendanceClient({ records }: Props) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {records.length === 0 ? (
        <li className="px-4 py-3 text-sm text-muted">No attendance records yet.</li>
      ) : (
        records.map((r) => (
          <li key={r.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
            <span>
              {r.date}
              {r.sessionLabel ? (
                <span className="text-muted"> · {r.sessionLabel}</span>
              ) : null}
            </span>
            <span className="font-medium capitalize">{r.status}</span>
          </li>
        ))
      )}
    </ul>
  );
}
