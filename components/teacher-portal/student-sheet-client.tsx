"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBehaviourRemarkAction } from "@/lib/behaviour";
import { upsertEventParticipantAction } from "@/lib/events";

type SubjectRow = { subjectId: string; name: string };

type ScheduleRow = {
  scheduleId: string;
  examDefinitionId: string;
  subjectId: string;
  label: string;
  maxMarks: number | null;
  markingOpen: boolean;
};

type EventOption = { id: string; title: string };

type Props = {
  employmentId: string | null;
  academicYearId: string;
  sectionId: string | null;
  student: {
    studentProfileId: string;
    fullName: string;
    admissionNumber: string | null;
    sectionLabel: string | null;
    className: string | null;
  };
  subjects: SubjectRow[];
  openSchedules: ScheduleRow[];
  events: EventOption[];
};

export function TeacherStudentSheetClient({
  employmentId,
  academicYearId,
  sectionId,
  student,
  subjects,
  openSchedules,
  events,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remarkTitle, setRemarkTitle] = useState("");
  const [remarkBody, setRemarkBody] = useState("");
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [positionLabel, setPositionLabel] = useState("");
  const [awardLabel, setAwardLabel] = useState("");
  const [eventRemark, setEventRemark] = useState("");

  const listParams = new URLSearchParams();
  if (employmentId) listParams.set("employment", employmentId);
  if (sectionId) listParams.set("sectionId", sectionId);

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm">
        <Link
          href={`/dashboard/teacher/students?${listParams.toString()}`}
          className="text-feezy-indigo hover:underline"
        >
          ← Students
        </Link>
      </p>

      <header className="space-y-1">
        <h2 className="font-display text-xl font-semibold">{student.fullName}</h2>
        <p className="text-sm text-muted">
          {student.sectionLabel ?? "No section this year"}
          {student.admissionNumber ? ` · Adm ${student.admissionNumber}` : ""}
        </p>
      </header>

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

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Subjects you teach</h3>
        {subjects.length === 0 ? (
          <p className="text-sm text-muted">
            No timetable subjects for this student&apos;s section under your
            employment.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {subjects.map((s) => (
              <li
                key={s.subjectId}
                className="rounded-lg border border-border px-3 py-1.5"
              >
                {s.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Open marking windows</h3>
        {openSchedules.filter((s) => s.markingOpen).length === 0 ? (
          <p className="text-sm text-muted">
            No open marking windows for your subjects. You can still add a
            remark below.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {openSchedules
              .filter((s) => s.markingOpen)
              .map((s) => {
                const params = new URLSearchParams();
                if (employmentId) params.set("employment", employmentId);
                params.set("scheduleId", s.scheduleId);
                params.set("examDefinitionId", s.examDefinitionId);
                params.set("subjectId", s.subjectId);
                return (
                  <li key={s.scheduleId}>
                    <Link
                      href={`/dashboard/teacher/marks?${params.toString()}`}
                      className="block px-4 py-3 text-sm hover:bg-surface"
                    >
                      {s.label}
                      {s.maxMarks != null ? ` · /${s.maxMarks}` : ""}
                    </Link>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Add remark</h3>
        <form
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await createBehaviourRemarkAction({
                studentProfileId: student.studentProfileId,
                academicYearId,
                remarkKind: "teacher_note",
                title: remarkTitle,
                body: remarkBody,
                visibility: "staff",
                employmentId,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage(result.message);
              setRemarkTitle("");
              setRemarkBody("");
              router.refresh();
            });
          }}
        >
          <input
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Title"
            value={remarkTitle}
            onChange={(e) => setRemarkTitle(e.target.value)}
          />
          <textarea
            required
            className="min-h-[72px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Remark"
            value={remarkBody}
            onChange={(e) => setRemarkBody(e.target.value)}
          />
          <button
            type="submit"
            disabled={pending}
            className="h-10 w-fit rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save remark"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Event participation</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted">No events this year.</p>
        ) : (
          <form
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const result = await upsertEventParticipantAction({
                  calendarEventId: eventId,
                  studentProfileId: student.studentProfileId,
                  attendanceStatus: "present",
                  positionLabel: positionLabel || null,
                  awardLabel: awardLabel || null,
                  remarks: eventRemark || null,
                  employmentId,
                });
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                setMessage(result.message);
                setPositionLabel("");
                setAwardLabel("");
                setEventRemark("");
                router.refresh();
              });
            }}
          >
            <select
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              required
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Position (e.g. 1st)"
              value={positionLabel}
              onChange={(e) => setPositionLabel(e.target.value)}
            />
            <input
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Award label"
              value={awardLabel}
              onChange={(e) => setAwardLabel(e.target.value)}
            />
            <textarea
              className="min-h-[56px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Remark"
              value={eventRemark}
              onChange={(e) => setEventRemark(e.target.value)}
            />
            <button
              type="submit"
              disabled={pending || !eventId}
              className="h-10 w-fit rounded-lg bg-feezy-indigo px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Record participation"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
