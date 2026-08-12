"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CALENDAR_EVENT_CATEGORIES,
  CALENDAR_EVENT_CATEGORY_LABELS,
  type AcademicYearStatus,
  type CalendarEventCategory,
} from "@/lib/calendar/types";
import { createAcademicYearAction } from "@/lib/calendar/years-actions";
import { upsertWorkingDayPatternAction } from "@/lib/calendar/working-days-actions";
import { createHolidayAction, archiveHolidayAction } from "@/lib/calendar/holidays-actions";
import {
  createCalendarEventAction,
  archiveCalendarEventAction,
  setCalendarEventApprovalAction,
} from "@/lib/calendar/events-actions";
import { createTermAction, archiveTermAction } from "@/lib/calendar/terms-actions";
import { CalendarGrid } from "@/components/calendar/calendar-grid";

type YearRow = {
  id: string;
  label: string;
  is_active: boolean;
  status: AcademicYearStatus;
  start_date: string | null;
  end_date: string | null;
};

type TermRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

type HolidayRow = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
};

type EventRow = {
  id: string;
  title: string;
  category: string;
  starts_at: string;
  ends_at: string;
  approval_status: string;
  location: string | null;
};

type WorkingDays = {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
};

type CalendarAdminClientProps = {
  years: YearRow[];
  selectedYearId: string | null;
  terms: TermRow[];
  holidays: HolidayRow[];
  events: EventRow[];
  workingDays: WorkingDays;
};

const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export function CalendarAdminClient({
  years,
  selectedYearId,
  terms,
  holidays,
  events,
  workingDays,
}: CalendarAdminClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [yearLabel, setYearLabel] = useState("");
  const [termName, setTermName] = useState("");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");
  const [holidayTitle, setHolidayTitle] = useState("");
  const [holidayStart, setHolidayStart] = useState("");
  const [holidayEnd, setHolidayEnd] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventCategory, setEventCategory] =
    useState<CalendarEventCategory>("ptm");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [days, setDays] = useState<WorkingDays>(workingDays);

  function run(action: () => Promise<{ success: boolean; error?: string; message?: string }>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setMessage(result.message ?? "Saved.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {message ? (
        <p className="rounded-xl border border-feezy-indigo/20 bg-feezy-indigo/5 px-4 py-3 text-sm text-foreground">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {selectedYearId ? (
        <CalendarGrid terms={terms} holidays={holidays} events={events} />
      ) : null}

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Academic years</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {years.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No years yet.</li>
          ) : (
            years.map((y) => (
              <li
                key={y.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <a
                    href={`/dashboard/calendar?year=${y.id}`}
                    className={
                      y.id === selectedYearId
                        ? "font-semibold text-feezy-magenta"
                        : "text-foreground hover:underline"
                    }
                  >
                    {y.label}
                  </a>
                  <span className="ml-2 text-muted">
                    {y.status}
                    {y.is_active ? " · active" : ""}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              createAcademicYearAction({ label: yearLabel, activate: true }),
            );
            setYearLabel("");
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            New year label
            <input
              value={yearLabel}
              onChange={(e) => setYearLabel(e.target.value)}
              placeholder="2026-27"
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              required
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            Create & activate
          </button>
        </form>
      </section>

      {selectedYearId ? (
        <>
          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Working days</h2>
            <div className="flex flex-wrap gap-3">
              {DAY_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm capitalize"
                >
                  <input
                    type="checkbox"
                    checked={days[key]}
                    onChange={(e) =>
                      setDays((d) => ({ ...d, [key]: e.target.checked }))
                    }
                  />
                  {key.slice(0, 3)}
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  upsertWorkingDayPatternAction({
                    academicYearId: selectedYearId,
                    ...days,
                  }),
                )
              }
              className="h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-strong disabled:opacity-60"
            >
              Save working days
            </button>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Terms</h2>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {terms.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted">No terms.</li>
              ) : (
                terms.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <span>
                      {t.name}{" "}
                      <span className="text-muted">
                        ({t.start_date} → {t.end_date})
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      className="text-xs text-muted hover:text-foreground"
                      onClick={() =>
                        run(() => archiveTermAction(t.id, selectedYearId))
                      }
                    >
                      Archive
                    </button>
                  </li>
                ))
              )}
            </ul>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  createTermAction({
                    academicYearId: selectedYearId,
                    name: termName,
                    startDate: termStart,
                    endDate: termEnd,
                  }),
                );
                setTermName("");
                setTermStart("");
                setTermEnd("");
              }}
            >
              <Field label="Name" value={termName} onChange={setTermName} />
              <Field
                label="Start"
                type="date"
                value={termStart}
                onChange={setTermStart}
              />
              <Field
                label="End"
                type="date"
                value={termEnd}
                onChange={setTermEnd}
              />
              <button
                type="submit"
                disabled={pending}
                className="h-10 rounded-lg bg-feezy-indigo px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                Add term
              </button>
            </form>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Holidays</h2>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {holidays.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted">No holidays.</li>
              ) : (
                holidays.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <span>
                      {h.title}{" "}
                      <span className="text-muted">
                        ({h.start_date} → {h.end_date})
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      className="text-xs text-muted hover:text-foreground"
                      onClick={() => run(() => archiveHolidayAction(h.id))}
                    >
                      Archive
                    </button>
                  </li>
                ))
              )}
            </ul>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  createHolidayAction({
                    academicYearId: selectedYearId,
                    title: holidayTitle,
                    startDate: holidayStart,
                    endDate: holidayEnd || holidayStart,
                  }),
                );
                setHolidayTitle("");
                setHolidayStart("");
                setHolidayEnd("");
              }}
            >
              <Field
                label="Title"
                value={holidayTitle}
                onChange={setHolidayTitle}
              />
              <Field
                label="Start"
                type="date"
                value={holidayStart}
                onChange={setHolidayStart}
              />
              <Field
                label="End"
                type="date"
                value={holidayEnd}
                onChange={setHolidayEnd}
              />
              <button
                type="submit"
                disabled={pending}
                className="h-10 rounded-lg bg-feezy-indigo px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                Add holiday
              </button>
            </form>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Events</h2>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {events.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted">No events.</li>
              ) : (
                events.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <div>
                      <span className="font-medium">{ev.title}</span>
                      <span className="ml-2 text-muted">
                        {ev.category} · {ev.approval_status}
                      </span>
                      <div className="text-xs text-muted">
                        {new Date(ev.starts_at).toLocaleString()} →{" "}
                        {new Date(ev.ends_at).toLocaleString()}
                        {ev.location ? ` · ${ev.location}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {ev.approval_status !== "published" ? (
                        <button
                          type="button"
                          disabled={pending}
                          className="text-xs text-feezy-indigo hover:underline"
                          onClick={() =>
                            run(() =>
                              setCalendarEventApprovalAction(ev.id, "published"),
                            )
                          }
                        >
                          Publish
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={pending}
                        className="text-xs text-muted hover:text-foreground"
                        onClick={() =>
                          run(() => archiveCalendarEventAction(ev.id))
                        }
                      >
                        Archive
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const startsAt = new Date(eventStart).toISOString();
                const endsAt = new Date(eventEnd || eventStart).toISOString();
                run(() =>
                  createCalendarEventAction({
                    academicYearId: selectedYearId,
                    title: eventTitle,
                    category: eventCategory,
                    startsAt,
                    endsAt,
                    location: eventLocation,
                    approvalStatus: "draft",
                    visibility: "school",
                  }),
                );
                setEventTitle("");
                setEventStart("");
                setEventEnd("");
                setEventLocation("");
              }}
            >
              <Field label="Title" value={eventTitle} onChange={setEventTitle} />
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Category
                <select
                  value={eventCategory}
                  onChange={(e) =>
                    setEventCategory(e.target.value as CalendarEventCategory)
                  }
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                >
                  {CALENDAR_EVENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CALENDAR_EVENT_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Start"
                type="datetime-local"
                value={eventStart}
                onChange={setEventStart}
              />
              <Field
                label="End"
                type="datetime-local"
                value={eventEnd}
                onChange={setEventEnd}
              />
              <Field
                label="Location"
                value={eventLocation}
                onChange={setEventLocation}
                required={false}
              />
              <button
                type="submit"
                disabled={pending}
                className="h-10 rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                Add event
              </button>
            </form>
          </section>
        </>
      ) : (
        <p className="text-sm text-muted">
          Create or select an academic year to manage terms, holidays, and
          events.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
      />
    </label>
  );
}
