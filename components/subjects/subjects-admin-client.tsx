"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveSubjectMasterAction,
  createSubjectMasterAction,
  updateSubjectMasterAction,
} from "@/lib/subjects/subjects-actions";
import {
  SUBJECT_CATEGORIES,
  SUBJECT_CATEGORY_LABELS,
  type SubjectCategory,
} from "@/lib/subjects/types";

type SubjectRow = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  type: string | null;
  is_language: boolean | null;
  is_elective: boolean | null;
  weekly_periods: number | null;
  requires_lab: boolean | null;
  board_code: string | null;
};

type Props = {
  subjects: SubjectRow[];
  canEdit: boolean;
};

export function SubjectsAdminClient({ subjects, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState<SubjectCategory>("scholastic");
  const [weeklyPeriods, setWeeklyPeriods] = useState("5");
  const [isLanguage, setIsLanguage] = useState(false);
  const [isElective, setIsElective] = useState(false);
  const [requiresLab, setRequiresLab] = useState(false);

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
      setEditingId(null);
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

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Subject master</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {subjects.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No subjects yet.</li>
          ) : (
            subjects.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                {editingId === s.id ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Name" value={editName} onChange={setEditName} />
                    <Field
                      label="Code"
                      value={editCode}
                      onChange={setEditCode}
                      required={false}
                    />
                    <button
                      type="button"
                      disabled={pending || !editName.trim()}
                      className="h-10 rounded-lg bg-feezy-indigo px-3 text-xs font-medium text-white disabled:opacity-60"
                      onClick={() =>
                        run(() =>
                          updateSubjectMasterAction({
                            id: s.id,
                            name: editName,
                            code: editCode || undefined,
                            category:
                              (s.category as SubjectCategory) ?? "scholastic",
                            isLanguage: Boolean(s.is_language),
                            isElective: Boolean(s.is_elective),
                            requiresLab: Boolean(s.requires_lab),
                            weeklyPeriods: s.weekly_periods,
                          }),
                        )
                      }
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="h-10 px-2 text-xs text-muted hover:text-foreground"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium">
                      {s.name}
                      {s.code ? (
                        <span className="ml-2 text-xs text-muted">{s.code}</span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {s.category ?? s.type ?? "—"}
                      {s.is_language ? " · Language" : ""}
                      {s.is_elective ? " · Elective" : ""}
                      {s.requires_lab ? " · Lab" : ""}
                      {s.weekly_periods != null
                        ? ` · ${s.weekly_periods} periods/week`
                        : ""}
                    </div>
                  </div>
                )}
                {canEdit && editingId !== s.id ? (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={pending}
                      className="text-xs text-muted hover:text-foreground"
                      onClick={() => {
                        setEditingId(s.id);
                        setEditName(s.name);
                        setEditCode(s.code ?? "");
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="text-xs text-muted hover:text-foreground"
                      onClick={() =>
                        run(() => archiveSubjectMasterAction(s.id))
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
      </section>

      {canEdit ? (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Add subject</h2>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() =>
                createSubjectMasterAction({
                  name,
                  code: code || undefined,
                  category,
                  isLanguage,
                  isElective,
                  requiresLab,
                  weeklyPeriods: weeklyPeriods
                    ? Number(weeklyPeriods)
                    : null,
                }),
              );
              setName("");
              setCode("");
            }}
          >
            <Field label="Name" value={name} onChange={setName} />
            <Field
              label="Code"
              value={code}
              onChange={setCode}
              required={false}
            />
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Category
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as SubjectCategory)
                }
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                {SUBJECT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {SUBJECT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Weekly periods"
              value={weeklyPeriods}
              onChange={setWeeklyPeriods}
              type="number"
              required={false}
            />
            <label className="flex items-center gap-2 pb-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={isLanguage}
                onChange={(e) => setIsLanguage(e.target.checked)}
              />
              Language
            </label>
            <label className="flex items-center gap-2 pb-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={isElective}
                onChange={(e) => setIsElective(e.target.checked)}
              />
              Elective
            </label>
            <label className="flex items-center gap-2 pb-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={requiresLab}
                onChange={(e) => setRequiresLab(e.target.checked)}
              />
              Requires lab
            </label>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="h-10 rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Create subject"}
            </button>
          </form>
        </section>
      ) : (
        <p className="text-sm text-muted">
          You can view subjects. Ask an admin for catalog edit access to add or
          archive.
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
