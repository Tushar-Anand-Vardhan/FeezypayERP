"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { downloadCsvTemplate } from "@/lib/onboarding/csv";
import { ENROLLMENT_CSV_HEADERS } from "@/lib/enrollment/csv";
import {
  assignSectionRollNumbersAction,
  importEnrollmentCsvAction,
  placeStudentsInSectionAction,
} from "@/lib/enrollment/placement-actions";
import {
  ROLL_STRATEGIES,
  ROLL_STRATEGY_LABELS,
  type RollStrategy,
} from "@/lib/enrollment/roll-assignment";

type StudentRow = {
  admissionId: string;
  studentProfileId: string;
  fullName: string;
  admissionNumber: string | null;
  studentAcademicYearId: string | null;
  sectionId: string | null;
  className: string | null;
  sectionName: string | null;
  rollNumber: string | null;
};

type SectionOption = {
  id: string;
  name: string;
  classId: string;
  className: string;
};

type Props = {
  years: Array<{ id: string; label: string; isActive: boolean }>;
  academicYearId: string;
  sections: SectionOption[];
  students: StudentRow[];
  canEdit: boolean;
};

export function PrincipalEnrollClient({
  years,
  academicYearId,
  sections,
  students,
  canEdit,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rollStrategy, setRollStrategy] = useState<RollStrategy>("sort_first_asc");
  const [filter, setFilter] = useState<"all" | "unplaced" | "section">("unplaced");

  const sectionLabel = useMemo(() => {
    const s = sections.find((x) => x.id === sectionId);
    return s ? `${s.className} · ${s.name}` : "";
  }, [sections, sectionId]);

  const visible = useMemo(() => {
    return students.filter((s) => {
      if (filter === "unplaced") return !s.sectionId;
      if (filter === "section") return s.sectionId === sectionId;
      return true;
    });
  }, [students, filter, sectionId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = visible.every((s) => next.has(s.admissionId));
      if (allSelected) {
        for (const s of visible) next.delete(s.admissionId);
      } else {
        for (const s of visible) next.add(s.admissionId);
      }
      return next;
    });
  }

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
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
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

      <div className="flex flex-wrap gap-2">
        {years.map((y) => (
          <Link
            key={y.id}
            href={`/dashboard/principal/enroll?year=${y.id}`}
            className={
              y.id === academicYearId
                ? "rounded-lg bg-feezy-indigo px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
            }
          >
            {y.label}
            {y.isActive ? " · active" : ""}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Target section
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="h-10 min-w-[14rem] rounded-lg border border-border bg-background px-3 text-sm"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.className} · {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          List filter
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "all" | "unplaced" | "section")
            }
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="unplaced">Unplaced only</option>
            <option value="section">In target section</option>
            <option value="all">All active admissions</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Roll after place / assign
          <select
            value={rollStrategy}
            onChange={(e) => setRollStrategy(e.target.value as RollStrategy)}
            className="h-10 min-w-[12rem] rounded-lg border border-border bg-background px-3 text-sm"
          >
            {ROLL_STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {ROLL_STRATEGY_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !sectionId || selected.size === 0}
            className="h-10 rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() =>
              run(() =>
                placeStudentsInSectionAction({
                  academicYearId,
                  sectionId,
                  admissionIds: [...selected],
                  rollStrategy,
                }),
              )
            }
          >
            Place selected ({selected.size}) → {sectionLabel || "section"}
          </button>
          <button
            type="button"
            disabled={pending || !sectionId}
            className="h-10 rounded-lg border border-border px-4 text-sm font-medium disabled:opacity-60"
            onClick={() =>
              run(() =>
                assignSectionRollNumbersAction({
                  academicYearId,
                  sectionId,
                  strategy: rollStrategy,
                }),
              )
            }
          >
            Reassign rolls in section
          </button>
          <button
            type="button"
            className="h-10 rounded-lg border border-border px-4 text-sm text-muted hover:text-foreground"
            onClick={() =>
              downloadCsvTemplate("enrollment-placements.csv", [
                ...ENROLLMENT_CSV_HEADERS,
              ], [["A-001", "Class 1", "A"]])
            }
          >
            Download CSV template
          </button>
          <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-border px-4 text-sm text-muted hover:text-foreground">
            Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  run(() =>
                    importEnrollmentCsvAction({
                      academicYearId,
                      csvText: String(reader.result ?? ""),
                      rollStrategy,
                    }),
                  );
                };
                reader.readAsText(file);
              }}
            />
          </label>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Placement edit permission is required to enroll or assign rolls.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">
                {canEdit ? (
                  <input
                    type="checkbox"
                    checked={
                      visible.length > 0 &&
                      visible.every((s) => selected.has(s.admissionId))
                    }
                    onChange={toggleAllVisible}
                  />
                ) : null}
              </th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Admission #</th>
              <th className="px-3 py-2">Current</th>
              <th className="px-3 py-2">Roll</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-muted">
                  No students match this filter.
                </td>
              </tr>
            ) : (
              visible.map((s) => (
                <tr key={s.admissionId}>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <input
                        type="checkbox"
                        checked={selected.has(s.admissionId)}
                        onChange={() => toggle(s.admissionId)}
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-medium">{s.fullName}</td>
                  <td className="px-3 py-2 text-muted">
                    {s.admissionNumber ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {s.className && s.sectionName
                      ? `${s.className} · ${s.sectionName}`
                      : "Unplaced"}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {s.rollNumber ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
