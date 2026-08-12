"use client";

import { useMemo, useState } from "react";

type TermRow = { id: string; name: string; start_date: string; end_date: string };
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

type Props = {
  terms: TermRow[];
  holidays: HolidayRow[];
  events: EventRow[];
  /** Optional exam sittings overlaid from assessments */
  examSlots?: Array<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
  }>;
};

type ViewMode = "month" | "week";

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function inDateRange(day: Date, start: string, end: string): boolean {
  const t = day.getTime();
  const s = new Date(`${start}T00:00:00`).getTime();
  const e = new Date(`${end}T23:59:59`).getTime();
  return t >= s && t <= e;
}

export function CalendarGrid({ terms, holidays, events, examSlots = [] }: Props) {
  const [mode, setMode] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const days = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    }
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [cursor, mode]);

  const title = useMemo(() => {
    if (mode === "week") {
      const start = days[0];
      const end = days[6];
      return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return cursor.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [cursor, days, mode]);

  function shift(delta: number) {
    setCursor((prev) => {
      const next = new Date(prev);
      if (mode === "week") {
        next.setDate(next.getDate() + delta * 7);
      } else {
        next.setMonth(next.getMonth() + delta);
      }
      return next;
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Calendar grid</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="h-9 rounded-lg border border-border px-3 text-sm"
            onClick={() => shift(-1)}
          >
            Prev
          </button>
          <button
            type="button"
            className="h-9 rounded-lg border border-border px-3 text-sm"
            onClick={() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              setCursor(d);
            }}
          >
            Today
          </button>
          <button
            type="button"
            className="h-9 rounded-lg border border-border px-3 text-sm"
            onClick={() => shift(1)}
          >
            Next
          </button>
          <div className="ml-2 flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs ${mode === "month" ? "bg-feezy-indigo/10 font-medium text-feezy-indigo" : "text-muted"}`}
              onClick={() => setMode("month")}
            >
              Month
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs ${mode === "week" ? "bg-feezy-indigo/10 font-medium text-feezy-indigo" : "text-muted"}`}
              onClick={() => setMode("week")}
            >
              Week
            </button>
          </div>
        </div>
      </div>
      <p className="text-sm text-muted">{title}</p>

      <div
        className={`grid gap-px overflow-hidden rounded-xl border border-border bg-border ${mode === "week" ? "grid-cols-7" : "grid-cols-7"}`}
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="bg-surface px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted"
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = sameDay(day, new Date());
          const dayHolidays = holidays.filter((h) =>
            inDateRange(day, h.start_date, h.end_date),
          );
          const dayTerms = terms.filter((t) =>
            inDateRange(day, t.start_date, t.end_date),
          );
          const dayEvents = events.filter((ev) => {
            const s = new Date(ev.starts_at);
            return sameDay(s, day);
          });
          const dayExams = examSlots.filter((ex) => {
            const s = new Date(ex.starts_at);
            return sameDay(s, day);
          });

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[5.5rem] bg-background p-1.5 ${
                mode === "month" && !inMonth ? "opacity-40" : ""
              } ${isToday ? "ring-1 ring-inset ring-feezy-indigo/40" : ""}`}
            >
              <div className="mb-1 text-xs font-medium">{day.getDate()}</div>
              <div className="space-y-0.5">
                {dayHolidays.map((h) => (
                  <div
                    key={h.id}
                    className="truncate rounded bg-amber-100 px-1 text-[10px] text-amber-950"
                    title={h.title}
                  >
                    {h.title}
                  </div>
                ))}
                {dayEvents.slice(0, mode === "week" ? 8 : 3).map((ev) => (
                  <div
                    key={ev.id}
                    className={`truncate rounded px-1 text-[10px] ${
                      ev.category === "competition"
                        ? "bg-feezy-magenta/15 text-feezy-magenta"
                        : "bg-feezy-indigo/10 text-feezy-indigo"
                    }`}
                    title={`${ev.title} (${ev.category})`}
                  >
                    {ev.category === "competition" ? "🏆 " : ""}
                    {ev.title}
                  </div>
                ))}
                {dayExams.slice(0, 2).map((ex) => (
                  <div
                    key={ex.id}
                    className="truncate rounded bg-emerald-100 px-1 text-[10px] text-emerald-900"
                    title={ex.title}
                  >
                    Exam · {ex.title}
                  </div>
                ))}
                {dayTerms.length > 0 && dayHolidays.length === 0 && dayEvents.length === 0 ? (
                  <div className="truncate text-[10px] text-muted">
                    {dayTerms[0].name}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        Holidays (amber) · events (indigo) · competitions (magenta) · exams
        (green). Create events below; competitions use category = competition.
      </p>
    </section>
  );
}
