"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  archiveExamSubjectScheduleAction,
  listExamSubjectSchedulesAction,
  upsertExamSubjectScheduleAction,
} from "@/lib/assessment/schedules-actions";
import {
  archiveAssessmentRubricAction,
  upsertAssessmentRubricAction,
} from "@/lib/assessment/rubrics-actions";
import type { RubricCriterionInput } from "@/lib/assessment/rubrics";

type ExamRow = {
  id: string;
  name: string;
  publishing_status: string;
  academic_year_id: string;
};

type SubjectOpt = { id: string; name: string };
type ClassOpt = {
  id: string;
  name: string;
  sections: Array<{ id: string; name: string }>;
};
type PeriodOpt = { id: string; label: string };
type RubricOpt = {
  id: string;
  code: string;
  name: string;
  criteria: Array<{
    id: string;
    name: string;
    max_score: number;
    weight: number;
    levels: unknown;
  }>;
};

type ScheduleRow = {
  id: string;
  subject_id: string;
  class_id: string;
  section_id: string | null;
  grading_type: string;
  max_marks: number | null;
  starts_at: string | null;
  ends_at: string | null;
  marking_opens_at: string | null;
  marking_closes_at: string | null;
  day_kind: string | null;
  period_id: string | null;
  rubric_id: string | null;
};

type Props = {
  years: Array<{ id: string; label: string; isActive: boolean }>;
  academicYearId: string;
  exams: ExamRow[];
  subjects: SubjectOpt[];
  classes: ClassOpt[];
  periods: PeriodOpt[];
  rubrics: RubricOpt[];
  canEdit: boolean;
};

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function AssessmentsAdminClient({
  years,
  academicYearId,
  exams,
  subjects,
  classes,
  periods,
  rubrics: initialRubrics,
  canEdit,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [examId, setExamId] = useState(exams[0]?.id ?? "");
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loadedExam, setLoadedExam] = useState<string | null>(null);
  const [rubrics, setRubrics] = useState(initialRubrics);

  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [sectionId, setSectionId] = useState("");
  const [gradingType, setGradingType] = useState<"marks" | "letter_grade" | "rubric">(
    "marks",
  );
  const [maxMarks, setMaxMarks] = useState("100");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [markingOpens, setMarkingOpens] = useState("");
  const [markingCloses, setMarkingCloses] = useState("");
  const [dayKind, setDayKind] = useState<"" | "half_day" | "full_day">("full_day");
  const [periodId, setPeriodId] = useState("");
  const [rubricId, setRubricId] = useState("");

  const [rubricName, setRubricName] = useState("");
  const [criterionName, setCriterionName] = useState("");
  const [criterionMax, setCriterionMax] = useState("4");
  const [draftCriteria, setDraftCriteria] = useState<RubricCriterionInput[]>([]);

  const sections = useMemo(
    () => classes.find((c) => c.id === classId)?.sections ?? [],
    [classes, classId],
  );

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

  function loadSchedules(id: string) {
    setExamId(id);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await listExamSubjectSchedulesAction(id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSchedules(
        (result.schedules as ScheduleRow[]).map((s) => ({
          id: String(s.id),
          subject_id: String(s.subject_id),
          class_id: String(s.class_id),
          section_id: (s.section_id as string | null) ?? null,
          grading_type: String(s.grading_type),
          max_marks: (s.max_marks as number | null) ?? null,
          starts_at: (s.starts_at as string | null) ?? null,
          ends_at: (s.ends_at as string | null) ?? null,
          marking_opens_at: (s.marking_opens_at as string | null) ?? null,
          marking_closes_at: (s.marking_closes_at as string | null) ?? null,
          day_kind: (s.day_kind as string | null) ?? null,
          period_id: (s.period_id as string | null) ?? null,
          rubric_id: (s.rubric_id as string | null) ?? null,
        })),
      );
      setLoadedExam(id);
    });
  }

  const subjectName = (id: string) =>
    subjects.find((s) => s.id === id)?.name ?? id;
  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-10">
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
            href={`/dashboard/assessments?year=${y.id}`}
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

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Exam schedules</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Exam definition
            <select
              value={examId}
              onChange={(e) => loadSchedules(e.target.value)}
              className="h-10 min-w-[16rem] rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Select exam…</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.publishing_status})
                </option>
              ))}
            </select>
          </label>
          {examId && loadedExam !== examId ? (
            <button
              type="button"
              className="h-10 rounded-lg border border-border px-3 text-sm"
              disabled={pending}
              onClick={() => loadSchedules(examId)}
            >
              Load schedules
            </button>
          ) : null}
        </div>

        {loadedExam ? (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {schedules.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted">No schedules yet.</li>
            ) : (
              schedules.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {subjectName(s.subject_id)} · {className(s.class_id)}
                      {s.section_id
                        ? ` · ${
                            classes
                              .flatMap((c) => c.sections)
                              .find((x) => x.id === s.section_id)?.name ??
                            "section"
                          }`
                        : " · all sections"}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {s.grading_type}
                      {s.max_marks != null ? ` · max ${s.max_marks}` : ""}
                      {s.day_kind ? ` · ${s.day_kind}` : ""}
                      {s.starts_at
                        ? ` · ${new Date(s.starts_at).toLocaleString()}`
                        : ""}
                      {s.marking_closes_at
                        ? ` · marks close ${new Date(s.marking_closes_at).toLocaleString()}`
                        : ""}
                    </div>
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="text-xs text-muted hover:text-foreground"
                      onClick={() =>
                        run(async () => {
                          const result = await archiveExamSubjectScheduleAction(
                            s.id,
                          );
                          if (result.success) {
                            setSchedules((prev) =>
                              prev.filter((x) => x.id !== s.id),
                            );
                          }
                          return result;
                        })
                      }
                    >
                      Archive
                    </button>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        ) : null}

        {canEdit && examId ? (
          <form
            className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const result = await upsertExamSubjectScheduleAction({
                  examDefinitionId: examId,
                  subjectId,
                  classId,
                  sectionId: sectionId || null,
                  gradingType,
                  maxMarks: maxMarks ? Number(maxMarks) : null,
                  startsAt: fromLocalInput(startsAt),
                  endsAt: fromLocalInput(endsAt),
                  markingOpensAt: fromLocalInput(markingOpens),
                  markingClosesAt: fromLocalInput(markingCloses),
                  dayKind: dayKind || null,
                  periodId: periodId || null,
                  rubricId: gradingType === "rubric" ? rubricId || null : null,
                });
                if (result.success) {
                  loadSchedules(examId);
                }
                return result;
              });
            }}
          >
            <h3 className="sm:col-span-2 lg:col-span-3 font-medium">
              Add / upsert schedule row
            </h3>
            <Select
              label="Subject"
              value={subjectId}
              onChange={setSubjectId}
              options={subjects.map((s) => ({ id: s.id, label: s.name }))}
            />
            <Select
              label="Class"
              value={classId}
              onChange={(v) => {
                setClassId(v);
                setSectionId("");
              }}
              options={classes.map((c) => ({ id: c.id, label: c.name }))}
            />
            <Select
              label="Section (optional)"
              value={sectionId}
              onChange={setSectionId}
              options={[
                { id: "", label: "All sections" },
                ...sections.map((s) => ({ id: s.id, label: s.name })),
              ]}
            />
            <Select
              label="Grading type"
              value={gradingType}
              onChange={(v) =>
                setGradingType(v as "marks" | "letter_grade" | "rubric")
              }
              options={[
                { id: "marks", label: "Marks" },
                { id: "letter_grade", label: "Letter grade" },
                { id: "rubric", label: "Rubric" },
              ]}
            />
            <Field label="Max marks" value={maxMarks} onChange={setMaxMarks} />
            <Select
              label="Day kind"
              value={dayKind}
              onChange={(v) => setDayKind(v as "" | "half_day" | "full_day")}
              options={[
                { id: "", label: "—" },
                { id: "full_day", label: "Full day" },
                { id: "half_day", label: "Half day" },
              ]}
            />
            <Field
              label="Starts"
              type="datetime-local"
              value={startsAt}
              onChange={setStartsAt}
            />
            <Field
              label="Ends"
              type="datetime-local"
              value={endsAt}
              onChange={setEndsAt}
            />
            <Field
              label="Marking opens"
              type="datetime-local"
              value={markingOpens}
              onChange={setMarkingOpens}
            />
            <Field
              label="Marking closes"
              type="datetime-local"
              value={markingCloses}
              onChange={setMarkingCloses}
            />
            <Select
              label="Period (optional)"
              value={periodId}
              onChange={setPeriodId}
              options={[
                { id: "", label: "Clock time only" },
                ...periods.map((p) => ({ id: p.id, label: p.label })),
              ]}
            />
            {gradingType === "rubric" ? (
              <Select
                label="Rubric"
                value={rubricId}
                onChange={setRubricId}
                options={[
                  { id: "", label: "Select rubric…" },
                  ...rubrics.map((r) => ({
                    id: r.id,
                    label: `${r.name} (${r.code})`,
                  })),
                ]}
              />
            ) : null}
            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={pending || !subjectId || !classId}
                className="h-10 rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save schedule"}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Rubric builder</h2>
        <p className="text-sm text-muted">
          Multi-criteria rubrics for schedules with grading type = rubric (beyond
          letter-grade bands).
        </p>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rubrics.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No rubrics yet.</li>
          ) : (
            rubrics.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {r.name}{" "}
                    <span className="text-xs text-muted">{r.code}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {r.criteria.length} criterion(a):{" "}
                    {r.criteria.map((c) => c.name).join(", ") || "—"}
                  </div>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="text-xs text-muted hover:text-foreground"
                    onClick={() =>
                      run(async () => {
                        const result = await archiveAssessmentRubricAction(r.id);
                        if (result.success) {
                          setRubrics((prev) => prev.filter((x) => x.id !== r.id));
                        }
                        return result;
                      })
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
          <div className="space-y-3 rounded-xl border border-border p-4">
            <Field label="Rubric name" value={rubricName} onChange={setRubricName} />
            <div className="flex flex-wrap items-end gap-2">
              <Field
                label="Criterion"
                value={criterionName}
                onChange={setCriterionName}
              />
              <Field
                label="Max score"
                value={criterionMax}
                onChange={setCriterionMax}
              />
              <button
                type="button"
                className="h-10 rounded-lg border border-border px-3 text-sm"
                onClick={() => {
                  if (!criterionName.trim()) return;
                  setDraftCriteria((prev) => [
                    ...prev,
                    {
                      name: criterionName.trim(),
                      maxScore: Number(criterionMax) || 4,
                      weight: 1,
                      levels: [
                        { label: "Emerging", score: 1 },
                        { label: "Developing", score: 2 },
                        { label: "Proficient", score: 3 },
                        { label: "Advanced", score: Number(criterionMax) || 4 },
                      ],
                    },
                  ]);
                  setCriterionName("");
                }}
              >
                Add criterion
              </button>
            </div>
            {draftCriteria.length > 0 ? (
              <ul className="text-sm text-muted">
                {draftCriteria.map((c, i) => (
                  <li key={`${c.name}-${i}`}>
                    {c.name} (max {c.maxScore})
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              disabled={pending || !rubricName.trim() || draftCriteria.length === 0}
              className="h-10 rounded-lg bg-feezy-indigo px-4 text-sm font-medium text-white disabled:opacity-60"
              onClick={() =>
                run(async () => {
                  const result = await upsertAssessmentRubricAction({
                    name: rubricName,
                    criteria: draftCriteria,
                  });
                  if (result.success) {
                    setRubricName("");
                    setDraftCriteria([]);
                    router.refresh();
                  }
                  return result;
                })
              }
            >
              Create rubric
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
      >
        {options.map((o) => (
          <option key={o.id || "none"} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
