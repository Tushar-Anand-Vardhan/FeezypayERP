"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createDepartmentAnnouncementAction } from "@/lib/departments/announcements-actions";

type Props = {
  departments: Array<{
    id: string;
    name: string;
    code: string | null;
    description: string | null;
  }>;
  selectedDepartmentId: string | null;
  memberships: Array<{
    id: string;
    employmentId: string;
    role: string;
    joinedOn: string;
  }>;
  subjects: Array<{ id: string; subjectId: string; isPrimary: boolean }>;
  announcements: Array<{
    id: string;
    title: string;
    status: string;
    publishedAt: string | null;
  }>;
  canCompose: boolean;
};

export function TeacherDepartmentClient({
  departments,
  selectedDepartmentId,
  memberships,
  subjects,
  announcements,
  canCompose,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = departments.find((d) => d.id === selectedDepartmentId);

  return (
    <div className="flex flex-col gap-8">
      {departments.length > 0 ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Department</span>
          <select
            className="max-w-sm rounded-lg border border-border bg-background px-3 py-2"
            value={selectedDepartmentId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              router.push(
                v
                  ? `/dashboard/teacher/department?department=${v}`
                  : "/dashboard/teacher/department",
              );
            }}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.code ? ` (${d.code})` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-muted">No departments available.</p>
      )}

      {selected?.description ? (
        <p className="text-sm text-muted">{selected.description}</p>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold">Members</h2>
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
          {memberships.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No members listed.</li>
          ) : (
            memberships.map((m) => (
              <li key={m.id} className="px-4 py-3 text-sm">
                {m.employmentId.slice(0, 8)} · {m.role} · joined {m.joinedOn}
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Subjects</h2>
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
          {subjects.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No subjects linked.</li>
          ) : (
            subjects.map((s) => (
              <li key={s.id} className="px-4 py-3 text-sm">
                {s.subjectId.slice(0, 8)}
                {s.isPrimary ? " · primary" : ""}
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Notices</h2>
        {canCompose && selectedDepartmentId ? (
          <form
            className="mt-2 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const result = await createDepartmentAnnouncementAction({
                  departmentId: selectedDepartmentId,
                  title,
                  body,
                  status: "published",
                  visibility: "department",
                });
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                setMessage(result.message);
                setTitle("");
                setBody("");
                router.refresh();
              });
            }}
          >
            <input
              required
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="min-h-[60px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button
              type="submit"
              disabled={pending}
              className="w-fit rounded-md bg-feezy-indigo px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Publish notice
            </button>
          </form>
        ) : null}
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
          {announcements.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No notices.</li>
          ) : (
            announcements.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <span className="font-medium">{a.title}</span>
                <span className="text-muted"> · {a.status}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      {message ? <p className="text-sm text-feezy-indigo">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
