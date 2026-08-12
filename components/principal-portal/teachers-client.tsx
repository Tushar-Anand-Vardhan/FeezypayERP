"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  endTeacherEmploymentAction,
  setEmploymentSubjectsAction,
  setSectionClassTeacherAction,
} from "@/lib/principal-ops/teachers-actions";

type TeacherRow = {
  employmentId: string;
  fullName: string;
  email: string | null;
  designation: string | null;
  status: string;
  subjectIds: string[];
  subjectNames: string[];
  classTeacherSections: Array<{ id: string; label: string }>;
  slotCount: number;
};

type Props = {
  teachers: TeacherRow[];
  subjects: Array<{ id: string; name: string }>;
  sections: Array<{
    id: string;
    label: string;
    classTeacherId: string | null;
  }>;
  canEdit: boolean;
};

export function PrincipalTeachersClient({
  teachers,
  subjects,
  sections,
  canEdit,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState(teachers[0]?.employmentId ?? "");
  const selected = teachers.find((t) => t.employmentId === selectedId) ?? null;
  const [subjectIds, setSubjectIds] = useState<string[]>(
    selected?.subjectIds ?? [],
  );
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");

  const sectionOptions = useMemo(() => sections, [sections]);

  function selectTeacher(id: string) {
    setSelectedId(id);
    const t = teachers.find((x) => x.employmentId === id);
    setSubjectIds(t?.subjectIds ?? []);
    setConflicts([]);
    setError(null);
    setMessage(null);
  }

  function run(
    action: () => Promise<{
      success: boolean;
      error?: string;
      message?: string;
      conflicts?: string[];
    }>,
  ) {
    setMessage(null);
    setError(null);
    setConflicts([]);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        setConflicts(result.conflicts ?? []);
        return;
      }
      setMessage(result.message ?? "Saved.");
      setConflicts(result.conflicts ?? []);
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
      {conflicts.length > 0 ? (
        <ul className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {conflicts.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Active teachers</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {teachers.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No active teachers.</li>
          ) : (
            teachers.map((t) => (
              <li key={t.employmentId}>
                <button
                  type="button"
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-surface ${
                    t.employmentId === selectedId ? "bg-surface" : ""
                  }`}
                  onClick={() => selectTeacher(t.employmentId)}
                >
                  <span className="font-medium">{t.fullName}</span>
                  <span className="text-muted">
                    {t.designation ? ` · ${t.designation}` : ""}
                    {t.email ? ` · ${t.email}` : ""}
                    {` · ${t.subjectNames.length} subjects`}
                    {t.classTeacherSections.length
                      ? ` · class teacher ×${t.classTeacherSections.length}`
                      : ""}
                    {t.slotCount ? ` · ${t.slotCount} slots` : ""}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      {selected && canEdit ? (
        <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <h2 className="font-display text-lg font-semibold">
            Edit {selected.fullName}
          </h2>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Teachable subjects</p>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-background p-2">
              {subjects.map((s) => {
                const checked = subjectIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSubjectIds((prev) =>
                          e.target.checked
                            ? [...prev, s.id]
                            : prev.filter((id) => id !== s.id),
                        );
                      }}
                    />
                    {s.name}
                  </label>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                className="h-9 rounded-lg bg-feezy-indigo px-3 text-sm font-medium text-white disabled:opacity-60"
                onClick={() =>
                  run(() =>
                    setEmploymentSubjectsAction({
                      employmentId: selected.employmentId,
                      subjectIds,
                    }),
                  )
                }
              >
                Save subjects
              </button>
              <button
                type="button"
                disabled={pending}
                className="h-9 rounded-lg border border-border px-3 text-sm disabled:opacity-60"
                onClick={() =>
                  run(() =>
                    setEmploymentSubjectsAction({
                      employmentId: selected.employmentId,
                      subjectIds,
                      force: true,
                    }),
                  )
                }
              >
                Force save subjects
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">
              Assign as class teacher
            </p>
            <select
              className="h-10 w-full max-w-md rounded-lg border border-border bg-background px-3 text-sm"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              {sectionOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.classTeacherId &&
                  s.classTeacherId !== selected.employmentId
                    ? " · has class teacher"
                    : ""}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || !sectionId}
                className="h-9 rounded-lg bg-feezy-magenta px-3 text-sm font-medium text-white disabled:opacity-60"
                onClick={() =>
                  run(() =>
                    setSectionClassTeacherAction({
                      sectionId,
                      employmentId: selected.employmentId,
                    }),
                  )
                }
              >
                Assign class teacher
              </button>
              <button
                type="button"
                disabled={pending || !sectionId}
                className="h-9 rounded-lg border border-border px-3 text-sm disabled:opacity-60"
                onClick={() =>
                  run(() =>
                    setSectionClassTeacherAction({
                      sectionId,
                      employmentId: selected.employmentId,
                      force: true,
                    }),
                  )
                }
              >
                Force overwrite
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={pending}
            className="h-9 rounded-lg border border-red-200 px-3 text-sm text-red-700 disabled:opacity-60"
            onClick={() => {
              if (
                !window.confirm(
                  `End employment for ${selected.fullName}? They will be removed from this school.`,
                )
              ) {
                return;
              }
              run(() => endTeacherEmploymentAction(selected.employmentId));
            }}
          >
            Remove from school
          </button>
        </section>
      ) : null}

      {!canEdit ? (
        <p className="text-sm text-muted">
          You can view teachers. Employment edit permission is required to
          change subjects or end employment.
        </p>
      ) : null}
    </div>
  );
}
