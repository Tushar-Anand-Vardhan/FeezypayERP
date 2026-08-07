"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  bulkUpsertMarksAction,
  publishMarkSessionAction,
} from "@/lib/assessment";

type MarkRow = {
  studentProfileId: string;
  fullName: string;
  marksObtained: string;
  isAbsent: boolean;
};

type ScheduleOption = {
  scheduleId: string;
  examDefinitionId: string;
  subjectId: string;
  label: string;
  maxMarks: number | null;
  sectionId: string | null;
  classId: string | null;
};

type Props = {
  employmentId: string | null;
  academicYearId: string;
  schedules: ScheduleOption[];
  selected: ScheduleOption | null;
  students: MarkRow[];
  sessionId: string | null;
};

export function TeacherMarksClient({
  employmentId,
  academicYearId,
  schedules,
  selected,
  students: initial,
  sessionId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function selectSchedule(scheduleId: string) {
    const params = new URLSearchParams();
    if (employmentId) params.set("employment", employmentId);
    const opt = schedules.find((s) => s.scheduleId === scheduleId);
    if (!opt) return;
    params.set("scheduleId", opt.scheduleId);
    params.set("examDefinitionId", opt.examDefinitionId);
    params.set("subjectId", opt.subjectId);
    router.push(`/dashboard/teacher/marks?${params.toString()}`);
  }

  if (!selected) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Choose a scheduled assessment to enter marks.
        </p>
        {schedules.length === 0 ? (
          <p className="text-sm text-muted">No scheduled assessments found.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {schedules.map((s) => (
              <li key={s.scheduleId}>
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left text-sm hover:bg-surface"
                  onClick={() => selectSchedule(s.scheduleId)}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex max-w-lg flex-col gap-1 text-sm">
        <span className="text-xs text-muted">Assessment</span>
        <select
          className="rounded-lg border border-border bg-surface px-3 py-2"
          value={selected.scheduleId}
          onChange={(e) => selectSchedule(e.target.value)}
        >
          {schedules.map((s) => (
            <option key={s.scheduleId} value={s.scheduleId}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          No roster for this schedule’s section/class.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map((row) => (
            <li
              key={row.studentProfileId}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <span className="min-w-[10rem] flex-1 text-sm font-medium">
                {row.fullName}
              </span>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={row.isAbsent}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r) =>
                        r.studentProfileId === row.studentProfileId
                          ? { ...r, isAbsent: e.target.checked }
                          : r,
                      ),
                    )
                  }
                />
                Absent
              </label>
              <input
                type="number"
                className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm"
                disabled={row.isAbsent}
                value={row.marksObtained}
                placeholder={
                  selected.maxMarks != null ? `/${selected.maxMarks}` : "marks"
                }
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) =>
                      r.studentProfileId === row.studentProfileId
                        ? { ...r, marksObtained: e.target.value }
                        : r,
                    ),
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || rows.length === 0}
          className="rounded-md bg-feezy-indigo px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await bulkUpsertMarksAction({
                examDefinitionId: selected.examDefinitionId,
                subjectId: selected.subjectId,
                academicYearId,
                sectionId: selected.sectionId,
                classId: selected.classId,
                scheduleId: selected.scheduleId,
                employmentId,
                marks: rows.map((r) => ({
                  studentProfileId: r.studentProfileId,
                  marksObtained: r.isAbsent
                    ? null
                    : r.marksObtained === ""
                      ? null
                      : Number(r.marksObtained),
                  isAbsent: r.isAbsent,
                  maxMarks: selected.maxMarks,
                })),
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage(result.message);
              router.refresh();
            });
          }}
        >
          Save marks
        </button>
        {sessionId ? (
          <button
            type="button"
            disabled={pending}
            className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await publishMarkSessionAction(sessionId);
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
      </div>
      {message ? <p className="text-sm text-feezy-indigo">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
