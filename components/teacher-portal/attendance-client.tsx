"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  bulkMarkDailyAttendanceAction,
  submitAttendanceSessionAction,
} from "@/lib/attendance";
import type { AttendanceMarkStatus } from "@/lib/attendance/types";

type StudentRow = {
  studentProfileId: string;
  fullName: string;
  status: AttendanceMarkStatus;
};

type Props = {
  employmentId: string | null;
  academicYearId: string;
  sectionId: string;
  attendanceDate: string;
  sectionLabel: string;
  isHomeClassroom: boolean;
  students: StudentRow[];
  sessionId: string | null;
  sections: Array<{ id: string; label: string; isHomeClassroom: boolean }>;
};

const STATUSES: AttendanceMarkStatus[] = [
  "present",
  "absent",
  "late",
  "half_day",
  "excused",
  "leave",
];

export function TeacherAttendanceClient({
  employmentId,
  academicYearId,
  sectionId,
  attendanceDate,
  sectionLabel,
  isHomeClassroom,
  students: initial,
  sessionId,
  sections,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setStatus(studentProfileId: string, status: AttendanceMarkStatus) {
    setRows((prev) =>
      prev.map((r) =>
        r.studentProfileId === studentProfileId ? { ...r, status } : r,
      ),
    );
  }

  function navigate(nextSection: string, nextDate: string) {
    const params = new URLSearchParams();
    if (employmentId) params.set("employment", employmentId);
    params.set("sectionId", nextSection);
    params.set("date", nextDate);
    router.push(`/dashboard/teacher/attendance?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted">Section</span>
          <select
            className="rounded-lg border border-border bg-surface px-3 py-2"
            value={sectionId}
            onChange={(e) => navigate(e.target.value, attendanceDate)}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
                {s.isHomeClassroom ? " · Home classroom" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted">Date</span>
          <input
            type="date"
            className="rounded-lg border border-border bg-surface px-3 py-2"
            value={attendanceDate}
            onChange={(e) => navigate(sectionId, e.target.value)}
          />
        </label>
      </div>

      <p className="text-sm text-muted">
        Marking{" "}
        <span className="font-medium text-foreground">{sectionLabel}</span>
        {isHomeClassroom ? " (Home classroom)" : ""} for {attendanceDate}.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No active students in this section.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map((row) => (
            <li
              key={row.studentProfileId}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <span className="text-sm font-medium">{row.fullName}</span>
              <select
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                value={row.status}
                onChange={(e) =>
                  setStatus(
                    row.studentProfileId,
                    e.target.value as AttendanceMarkStatus,
                  )
                }
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
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
              const result = await bulkMarkDailyAttendanceAction({
                sectionId,
                academicYearId,
                attendanceDate,
                employmentId,
                marks: rows.map((r) => ({
                  studentProfileId: r.studentProfileId,
                  status: r.status,
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
                const result = await submitAttendanceSessionAction(sessionId);
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                setMessage(result.message);
                router.refresh();
              });
            }}
          >
            Submit session
          </button>
        ) : null}
      </div>

      {message ? <p className="text-sm text-feezy-indigo">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
