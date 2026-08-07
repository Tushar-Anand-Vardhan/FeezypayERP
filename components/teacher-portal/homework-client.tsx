"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createHomeworkAction,
  publishHomeworkAction,
} from "@/lib/homework";
import type { AssignmentKind } from "@/lib/homework/types";

type HomeworkRow = {
  id: string;
  title: string;
  status: string;
  dueOn: string | null;
  sectionId: string | null;
};

type Props = {
  employmentId: string;
  academicYearId: string;
  sections: Array<{ id: string; label: string }>;
  rows: HomeworkRow[];
};

export function TeacherHomeworkClient({
  employmentId,
  academicYearId,
  sections,
  rows,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [dueOn, setDueOn] = useState("");
  const [kind, setKind] = useState<AssignmentKind>("homework");
  const [publishNow, setPublishNow] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qs = `?employment=${employmentId}`;

  return (
    <div className="flex flex-col gap-8">
      <form
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setMessage(null);
          startTransition(async () => {
            const result = await createHomeworkAction({
              academicYearId,
              employmentId,
              sectionId,
              assignmentKind: kind,
              title,
              dueOn: dueOn || null,
              publishNow,
            });
            if (!result.success) {
              setError(result.error);
              return;
            }
            setMessage(result.message);
            setTitle("");
            router.refresh();
          });
        }}
      >
        <h2 className="text-sm font-semibold">Assign homework</h2>
        <input
          required
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as AssignmentKind)}
          >
            <option value="homework">Homework</option>
            <option value="assignment">Assignment</option>
            <option value="project">Project</option>
          </select>
          <input
            type="date"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
            />
            Publish now
          </label>
        </div>
        <button
          type="submit"
          disabled={pending || !sectionId}
          className="w-fit rounded-md bg-feezy-indigo px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Create
        </button>
      </form>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {rows.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">No homework yet.</li>
        ) : (
          rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <Link
                href={`/dashboard/teacher/homework/${row.id}${qs}`}
                className="font-medium text-feezy-indigo hover:underline"
              >
                {row.title}
                <span className="text-muted">
                  {" "}
                  · {row.status}
                  {row.dueOn ? ` · due ${row.dueOn}` : ""}
                </span>
              </Link>
              {row.status === "draft" ? (
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-50"
                  onClick={() => {
                    startTransition(async () => {
                      const result = await publishHomeworkAction(row.id);
                      if (!result.success) {
                        setError(result.error);
                        return;
                      }
                      setMessage(result.message);
                      router.refresh();
                    });
                  }}
                >
                  Publish
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
      {message ? <p className="text-sm text-feezy-indigo">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
