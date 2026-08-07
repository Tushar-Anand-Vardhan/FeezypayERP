"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBehaviourRemarkAction } from "@/lib/behaviour";
import type { RemarkKind, RemarkVisibility } from "@/lib/behaviour/types";
import { REMARK_KINDS, REMARK_VISIBILITIES } from "@/lib/behaviour/types";

type RemarkRow = {
  id: string;
  title: string;
  remarkKind: string;
  visibility: string;
  recordedAt: string | null;
  studentProfileId: string;
};

type Props = {
  employmentId: string | null;
  academicYearId: string;
  students: Array<{ studentProfileId: string; fullName: string }>;
  remarks: RemarkRow[];
};

export function TeacherBehaviourClient({
  employmentId,
  academicYearId,
  students,
  remarks,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [studentProfileId, setStudentProfileId] = useState(
    students[0]?.studentProfileId ?? "",
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [remarkKind, setRemarkKind] = useState<RemarkKind>("teacher_note");
  const [visibility, setVisibility] =
    useState<RemarkVisibility>("staff");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <form
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setMessage(null);
          startTransition(async () => {
            const result = await createBehaviourRemarkAction({
              studentProfileId,
              academicYearId,
              remarkKind,
              title,
              body,
              visibility,
              employmentId,
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
        <h2 className="text-sm font-semibold">Record remark</h2>
        <select
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={studentProfileId}
          onChange={(e) => setStudentProfileId(e.target.value)}
          required
        >
          {students.map((s) => (
            <option key={s.studentProfileId} value={s.studentProfileId}>
              {s.fullName}
            </option>
          ))}
        </select>
        <input
          required
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Details"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={remarkKind}
            onChange={(e) => setRemarkKind(e.target.value as RemarkKind)}
          >
            {REMARK_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value as RemarkVisibility)
            }
          >
            {REMARK_VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending || !studentProfileId}
          className="w-fit rounded-md bg-feezy-indigo px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save remark
        </button>
      </form>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {remarks.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">No remarks yet.</li>
        ) : (
          remarks.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              <span className="font-medium">{r.title}</span>
              <span className="text-muted">
                {" "}
                · {r.remarkKind} · {r.visibility}
                {r.recordedAt
                  ? ` · ${new Date(r.recordedAt).toLocaleString()}`
                  : ""}
              </span>
            </li>
          ))
        )}
      </ul>
      {message ? <p className="text-sm text-feezy-indigo">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
