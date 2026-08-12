"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  activateTimetableGridAction,
  archiveTimetableGridAction,
  createTimetableGridAction,
} from "@/lib/timetable/grids-actions";
import {
  archivePeriodAction,
  upsertPeriodAction,
} from "@/lib/timetable/periods-actions";
import type { TimetableGridType } from "@/lib/timetable/types";

type YearRow = { id: string; label: string; is_active: boolean };

type PeriodRow = {
  id: string;
  period_number: number;
  start_time: string;
  end_time: string;
  name: string | null;
  is_break: boolean;
  is_locked: boolean;
};

type GridRow = {
  id: string;
  name: string;
  grid_type: string;
  cycle_length: number;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
};

type Props = {
  years: YearRow[];
  selectedYearId: string | null;
  periods: PeriodRow[];
  grids: GridRow[];
  canEdit: boolean;
};

const GRID_TYPES: TimetableGridType[] = [
  "primary",
  "alternate",
  "exam",
  "special",
];

export function TimetableAdminClient({
  years,
  selectedYearId,
  periods,
  grids,
  canEdit,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [periodNumber, setPeriodNumber] = useState(
    String((periods.at(-1)?.period_number ?? 0) + 1),
  );
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:40");
  const [periodName, setPeriodName] = useState("");
  const [isBreak, setIsBreak] = useState(false);

  const [gridName, setGridName] = useState("");
  const [gridType, setGridType] = useState<TimetableGridType>("primary");
  const [cycleLength, setCycleLength] = useState("6");
  const [activateOnCreate, setActivateOnCreate] = useState(true);

  function run(
    action: () => Promise<{
      success: boolean;
      error?: string;
      message?: string;
    }>,
  ) {
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
        <h2 className="font-display text-lg font-semibold">Academic year</h2>
        {years.length === 0 ? (
          <p className="text-sm text-muted">
            Create an academic year on the{" "}
            <Link href="/dashboard/calendar" className="underline">
              calendar
            </Link>{" "}
            first.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {years.map((y) => (
              <Link
                key={y.id}
                href={`/dashboard/timetable?year=${y.id}`}
                className={
                  y.id === selectedYearId
                    ? "rounded-lg bg-feezy-indigo px-3 py-1.5 text-sm font-medium text-white"
                    : "rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
                }
              >
                {y.label}
                {y.is_active ? " · active" : ""}
              </Link>
            ))}
          </div>
        )}
      </section>

      {selectedYearId ? (
        <>
          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold">
              Period definitions
            </h2>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {periods.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted">
                  No periods defined for this year.
                </li>
              ) : (
                periods.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div>
                      <span className="font-medium">
                        P{p.period_number}
                        {p.name ? ` · ${p.name}` : ""}
                      </span>
                      <span className="ml-2 text-xs text-muted">
                        {String(p.start_time).slice(0, 5)}–
                        {String(p.end_time).slice(0, 5)}
                        {p.is_break ? " · Break" : ""}
                        {p.is_locked ? " · Locked" : ""}
                      </span>
                    </div>
                    {canEdit && !p.is_locked ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="text-xs text-muted hover:text-foreground"
                        onClick={() =>
                          run(() => archivePeriodAction(p.id))
                        }
                      >
                        Archive
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>

            {canEdit ? (
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() =>
                    upsertPeriodAction({
                      academicYearId: selectedYearId,
                      periodNumber: Number(periodNumber),
                      startTime,
                      endTime,
                      name: periodName || undefined,
                      isBreak,
                    }),
                  );
                  setPeriodNumber(String(Number(periodNumber) + 1));
                  setPeriodName("");
                  setIsBreak(false);
                }}
              >
                <Field
                  label="Period #"
                  value={periodNumber}
                  onChange={setPeriodNumber}
                  type="number"
                />
                <Field
                  label="Start"
                  value={startTime}
                  onChange={setStartTime}
                  type="time"
                />
                <Field
                  label="End"
                  value={endTime}
                  onChange={setEndTime}
                  type="time"
                />
                <Field
                  label="Name"
                  value={periodName}
                  onChange={setPeriodName}
                  required={false}
                />
                <label className="flex items-center gap-2 pb-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={isBreak}
                    onChange={(e) => setIsBreak(e.target.checked)}
                  />
                  Break
                </label>
                <button
                  type="submit"
                  disabled={pending}
                  className="h-10 rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Add period"}
                </button>
              </form>
            ) : null}
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold">
              Timetable grids
            </h2>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {grids.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted">
                  No grids for this year.
                </li>
              ) : (
                grids.map((g) => (
                  <li
                    key={g.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        {g.name}
                        {g.is_active ? (
                          <span className="ml-2 text-xs text-feezy-indigo">
                            Active
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {g.grid_type} · {g.cycle_length}-day cycle
                        {g.effective_from
                          ? ` · from ${g.effective_from}`
                          : ""}
                      </div>
                    </div>
                    {canEdit ? (
                      <div className="flex gap-3">
                        {!g.is_active ? (
                          <button
                            type="button"
                            disabled={pending}
                            className="text-xs text-feezy-indigo hover:underline"
                            onClick={() =>
                              run(() => activateTimetableGridAction(g.id))
                            }
                          >
                            Activate
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={pending}
                          className="text-xs text-muted hover:text-foreground"
                          onClick={() =>
                            run(() => archiveTimetableGridAction(g.id))
                          }
                        >
                          Archive
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))
              )}
            </ul>

            {canEdit ? (
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() =>
                    createTimetableGridAction({
                      academicYearId: selectedYearId,
                      name: gridName,
                      gridType,
                      cycleLength: Number(cycleLength) || 6,
                      isActive: activateOnCreate,
                    }),
                  );
                  setGridName("");
                }}
              >
                <Field label="Grid name" value={gridName} onChange={setGridName} />
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  Type
                  <select
                    value={gridType}
                    onChange={(e) =>
                      setGridType(e.target.value as TimetableGridType)
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  >
                    {GRID_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Cycle length"
                  value={cycleLength}
                  onChange={setCycleLength}
                  type="number"
                />
                <label className="flex items-center gap-2 pb-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={activateOnCreate}
                    onChange={(e) => setActivateOnCreate(e.target.checked)}
                  />
                  Activate on create
                </label>
                <button
                  type="submit"
                  disabled={pending || !gridName.trim()}
                  className="h-10 rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Create grid"}
                </button>
              </form>
            ) : null}
          </section>

          {!canEdit ? (
            <p className="text-sm text-muted">
              You can view timetable configuration. Ask an admin for grid edit
              access to change periods or grids. Slot assignment stays in the
              timetable slot APIs.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Period slots (section × day × subject) are managed via timetable
              slot APIs — this page covers period bells and grid cycles.
            </p>
          )}
        </>
      ) : null}
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
