"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  upsertEventParticipantAction,
} from "@/lib/events";
import type { EventAttendanceStatus } from "@/lib/events/types";

type EventRow = {
  id: string;
  title: string;
  category: string;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  approvalStatus: string;
  isCoordinator: boolean;
};

type StudentOption = {
  studentProfileId: string;
  fullName: string;
};

type ParticipantRow = {
  id: string;
  studentProfileId: string;
  fullName: string;
  attendanceStatus: string | null;
  positionLabel: string | null;
  awardLabel: string | null;
  remarks: string | null;
};

type Props = {
  employmentId: string | null;
  events: EventRow[];
  selectedEventId: string | null;
  canWrite: boolean;
  students: StudentOption[];
  participants: ParticipantRow[];
};

export function TeacherEventsClient({
  employmentId,
  events,
  selectedEventId,
  canWrite,
  students,
  participants,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studentProfileId, setStudentProfileId] = useState(
    students[0]?.studentProfileId ?? "",
  );
  const [attendanceStatus, setAttendanceStatus] =
    useState<EventAttendanceStatus>("present");
  const [positionLabel, setPositionLabel] = useState("");
  const [awardLabel, setAwardLabel] = useState("");
  const [remarks, setRemarks] = useState("");

  const selected = events.find((e) => e.id === selectedEventId) ?? null;

  function selectEvent(id: string) {
    const params = new URLSearchParams();
    if (employmentId) params.set("employment", employmentId);
    params.set("eventId", id);
    router.push(`/dashboard/teacher/events?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-8">
      {message ? (
        <p className="rounded-xl border border-feezy-indigo/20 bg-feezy-indigo/5 px-4 py-3 text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-border rounded-xl border border-border">
        {events.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">No events yet.</li>
        ) : (
          events.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={`w-full px-4 py-3 text-left text-sm hover:bg-surface ${
                  e.id === selectedEventId ? "bg-surface" : ""
                }`}
                onClick={() => selectEvent(e.id)}
              >
                <span className="font-medium">{e.title}</span>
                <span className="text-muted">
                  {" "}
                  · {e.category}
                  {e.startsAt
                    ? ` · ${new Date(e.startsAt).toLocaleString()}`
                    : ""}
                  {e.isCoordinator ? " · Coordinator" : ""}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>

      {selected ? (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">{selected.title}</h2>
          {!selected.isCoordinator ? (
            <p className="text-sm text-muted">
              You are not assigned as staff on this event. Ask an admin to add
              you as in-charge / assistant to record performances.
            </p>
          ) : null}

          <div>
            <h3 className="mb-2 text-sm font-semibold">Participants</h3>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {participants.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted">
                  No participants recorded yet.
                </li>
              ) : (
                participants.map((p) => (
                  <li key={p.id} className="px-4 py-3 text-sm">
                    <span className="font-medium">{p.fullName}</span>
                    <span className="text-muted">
                      {p.attendanceStatus ? ` · ${p.attendanceStatus}` : ""}
                      {p.positionLabel ? ` · ${p.positionLabel}` : ""}
                      {p.awardLabel ? ` · ${p.awardLabel}` : ""}
                      {p.remarks ? ` · ${p.remarks}` : ""}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>

          {canWrite && selected.isCoordinator ? (
            <form
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                setMessage(null);
                startTransition(async () => {
                  const result = await upsertEventParticipantAction({
                    calendarEventId: selected.id,
                    studentProfileId,
                    attendanceStatus,
                    positionLabel: positionLabel || null,
                    awardLabel: awardLabel || null,
                    remarks: remarks || null,
                    employmentId,
                  });
                  if (!result.success) {
                    setError(result.error);
                    return;
                  }
                  setMessage(result.message);
                  setPositionLabel("");
                  setAwardLabel("");
                  setRemarks("");
                  router.refresh();
                });
              }}
            >
              <h3 className="text-sm font-semibold">
                Record student performance
              </h3>
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
              <select
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={attendanceStatus}
                onChange={(e) =>
                  setAttendanceStatus(e.target.value as EventAttendanceStatus)
                }
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="excused">Excused</option>
                <option value="no_show">No show</option>
              </select>
              <input
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Position (1st / 2nd / …)"
                value={positionLabel}
                onChange={(e) => setPositionLabel(e.target.value)}
              />
              <input
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Award"
                value={awardLabel}
                onChange={(e) => setAwardLabel(e.target.value)}
              />
              <textarea
                className="min-h-[56px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Remark"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              <button
                type="submit"
                disabled={pending || !studentProfileId}
                className="h-10 w-fit rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save participant"}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
