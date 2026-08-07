type EventRow = {
  id: string;
  title: string;
  category: string;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  approvalStatus: string;
};

type Props = {
  events: EventRow[];
};

export function TeacherEventsClient({ events }: Props) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {events.length === 0 ? (
        <li className="px-4 py-3 text-sm text-muted">No events yet.</li>
      ) : (
        events.map((e) => (
          <li key={e.id} className="px-4 py-3 text-sm">
            <span className="font-medium">{e.title}</span>
            <span className="text-muted">
              {" "}
              · {e.category}
              {e.startsAt
                ? ` · ${new Date(e.startsAt).toLocaleString()}`
                : ""}
              {e.location ? ` · ${e.location}` : ""}
              {e.approvalStatus ? ` · ${e.approvalStatus}` : ""}
            </span>
          </li>
        ))
      )}
    </ul>
  );
}
