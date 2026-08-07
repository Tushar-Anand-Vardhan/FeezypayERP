"use client";

import { useRouter } from "next/navigation";

type MessageRow = {
  id: string;
  title: string;
  kind: string;
  status: string;
  publishedAt: string | null;
  source: "school" | "department";
};

type Props = {
  messages: MessageRow[];
  departments: Array<{ id: string; name: string }>;
  selectedDepartmentId: string | null;
};

export function TeacherAnnouncementsClient({
  messages,
  departments,
  selectedDepartmentId,
}: Props) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      {departments.length > 0 ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Department notices</span>
          <select
            className="max-w-sm rounded-lg border border-border bg-background px-3 py-2"
            value={selectedDepartmentId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              router.push(
                v
                  ? `/dashboard/teacher/announcements?department=${v}`
                  : "/dashboard/teacher/announcements",
              );
            }}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <ul className="divide-y divide-border rounded-xl border border-border">
        {messages.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">
            No announcements yet.
          </li>
        ) : (
          messages.map((m) => (
            <li key={`${m.source}-${m.id}`} className="px-4 py-3 text-sm">
              <span className="font-medium">{m.title}</span>
              <span className="text-muted">
                {" "}
                · {m.source}
                {m.kind ? ` · ${m.kind}` : ""}
                {m.publishedAt
                  ? ` · ${new Date(m.publishedAt).toLocaleString()}`
                  : ""}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
