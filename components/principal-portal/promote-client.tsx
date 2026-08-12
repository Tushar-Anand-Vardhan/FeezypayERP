"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  applyPromotionBatchAction,
  type PromotionDecision,
} from "@/lib/principal-ops/promote-actions";

type Candidate = {
  studentAcademicYearId: string;
  admissionId: string;
  studentProfileId: string;
  fullName: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  rollNumber: string | null;
  suggestedNextClassId: string | null;
  suggestedNextSectionId: string | null;
};

type TargetClass = {
  id: string;
  name: string;
  displayOrder: number;
  sections: Array<{ id: string; name: string }>;
};

type DecisionState = {
  decision: PromotionDecision;
  targetClassId: string;
  targetSectionId: string;
};

type Props = {
  sourceYearId: string;
  years: Array<{ id: string; label: string; isActive: boolean }>;
  rules: Record<string, unknown>;
  candidates: Candidate[];
  targetClasses: TargetClass[];
};

export function PrincipalPromoteClient({
  sourceYearId,
  years,
  rules,
  candidates,
  targetClasses,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetYearId, setTargetYearId] = useState(
    years.find((y) => y.id !== sourceYearId)?.id ?? sourceYearId,
  );

  // When target year changes in the select, navigate so server reloads target classes
  function onTargetYearChange(next: string) {
    setTargetYearId(next);
    router.push(
      `/dashboard/principal/promote?year=${sourceYearId}&target=${next}`,
    );
  }

  const initial = useMemo(() => {
    const map: Record<string, DecisionState> = {};
    for (const c of candidates) {
      map[c.studentAcademicYearId] = {
        decision: c.suggestedNextClassId ? "promoted" : "graduated",
        targetClassId: c.suggestedNextClassId ?? c.classId,
        targetSectionId: c.suggestedNextSectionId ?? c.sectionId,
      };
    }
    return map;
  }, [candidates]);

  const [decisions, setDecisions] = useState(initial);

  function update(id: string, patch: Partial<DecisionState>) {
    setDecisions((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  const sectionsFor = (classId: string) =>
    targetClasses.find((c) => c.id === classId)?.sections ?? [];

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

      <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
        <p className="font-medium text-foreground">Promotion rules in force</p>
        <p className="mt-1 text-xs">
          min overall {String(rules.min_overall_percent ?? "—")}% · min subject
          pass {String(rules.min_subject_pass_percent ?? "—")}% · max failed{" "}
          {String(rules.max_failed_subjects ?? "—")} · compartment{" "}
          {String(rules.allow_compartment ?? "—")}
        </p>
        <p className="mt-1 text-xs">
          Wave 2: principal decision is authoritative; rules are shown for
          guidance (WF-PRI-10).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          {years.map((y) => (
            <Link
              key={y.id}
              href={`/dashboard/principal/promote?year=${y.id}`}
              className={
                y.id === sourceYearId
                  ? "rounded-lg bg-feezy-indigo px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
              }
            >
              Source: {y.label}
            </Link>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Target year
          <select
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            value={targetYearId}
            onChange={(e) => onTargetYearChange(e.target.value)}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {candidates.length === 0 ? (
        <p className="text-sm text-muted">
          No active placements in this year.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {candidates.map((c) => {
            const d = decisions[c.studentAcademicYearId];
            return (
              <li
                key={c.studentAcademicYearId}
                className="flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{c.fullName}</div>
                  <div className="text-xs text-muted">
                    {c.className} · {c.sectionName}
                    {c.rollNumber ? ` · Roll ${c.rollNumber}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                    value={d?.decision ?? "promoted"}
                    onChange={(e) =>
                      update(c.studentAcademicYearId, {
                        decision: e.target.value as PromotionDecision,
                      })
                    }
                  >
                    <option value="promoted">Promote</option>
                    <option value="repeated">Repeat</option>
                    <option value="graduated">Graduate</option>
                  </select>
                  {d?.decision !== "graduated" ? (
                    <>
                      <select
                        className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                        value={d?.targetClassId ?? ""}
                        onChange={(e) => {
                          const classId = e.target.value;
                          const firstSec = sectionsFor(classId)[0]?.id ?? "";
                          update(c.studentAcademicYearId, {
                            targetClassId: classId,
                            targetSectionId: firstSec,
                          });
                        }}
                      >
                        {targetClasses.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                        value={d?.targetSectionId ?? ""}
                        onChange={(e) =>
                          update(c.studentAcademicYearId, {
                            targetSectionId: e.target.value,
                          })
                        }
                      >
                        {sectionsFor(d?.targetClassId ?? "").map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        disabled={pending || candidates.length === 0}
        className="h-10 rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
        onClick={() => {
          if (
            !window.confirm(
              `Apply ${candidates.length} promotion decision(s)? This closes current placements.`,
            )
          ) {
            return;
          }
          setMessage(null);
          setError(null);
          startTransition(async () => {
            const payload = candidates.map((c) => {
              const d = decisions[c.studentAcademicYearId];
              return {
                studentAcademicYearId: c.studentAcademicYearId,
                decision: d.decision,
                targetClassId:
                  d.decision === "graduated" ? null : d.targetClassId,
                targetSectionId:
                  d.decision === "graduated" ? null : d.targetSectionId,
              };
            });
            const result = await applyPromotionBatchAction({
              sourceAcademicYearId: sourceYearId,
              targetAcademicYearId: targetYearId,
              decisions: payload,
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
        {pending ? "Applying…" : "Apply batch"}
      </button>
    </div>
  );
}
