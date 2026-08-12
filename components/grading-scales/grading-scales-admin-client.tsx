"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveGradingScaleAction,
  createGradingScaleAction,
} from "@/lib/config/grading-scales-actions";
import type { GradingBand } from "@/lib/config/types";

type ScaleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  version: number | null;
  bands: GradingBand[];
};

type Props = {
  scales: ScaleRow[];
  canEdit: boolean;
};

const DEFAULT_BANDS: GradingBand[] = [
  { min: 91, max: 100, grade: "A1", label: "Outstanding" },
  { min: 81, max: 90, grade: "A2", label: "Excellent" },
  { min: 71, max: 80, grade: "B1", label: "Very good" },
  { min: 61, max: 70, grade: "B2", label: "Good" },
  { min: 51, max: 60, grade: "C1", label: "Satisfactory" },
  { min: 41, max: 50, grade: "C2", label: "Average" },
  { min: 33, max: 40, grade: "D", label: "Needs improvement" },
  { min: 0, max: 32, grade: "E", label: "Unsatisfactory" },
];

export function GradingScalesAdminClient({ scales, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [bands, setBands] = useState<GradingBand[]>(DEFAULT_BANDS);

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

  function updateBand(index: number, patch: Partial<GradingBand>) {
    setBands((prev) =>
      prev.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    );
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
        <h2 className="font-display text-lg font-semibold">Grading scales</h2>
        {scales.length === 0 ? (
          <p className="rounded-xl border border-border px-4 py-3 text-sm text-muted">
            No grading scales yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {scales.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-border px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {s.name}
                      <span className="ml-2 text-xs text-muted">{s.code}</span>
                      {s.version != null ? (
                        <span className="ml-2 text-xs text-muted">
                          v{s.version}
                        </span>
                      ) : null}
                    </div>
                    {s.description ? (
                      <p className="mt-1 text-xs text-muted">{s.description}</p>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="text-xs text-muted hover:text-foreground"
                      onClick={() =>
                        run(() => archiveGradingScaleAction(s.id))
                      }
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[320px] text-left text-xs">
                    <thead className="text-muted">
                      <tr>
                        <th className="pb-2 font-medium">Grade</th>
                        <th className="pb-2 font-medium">Min</th>
                        <th className="pb-2 font-medium">Max</th>
                        <th className="pb-2 font-medium">Label</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.bands.map((b, i) => (
                        <tr key={`${s.id}-${i}`} className="border-t border-border/60">
                          <td className="py-1.5 font-medium">{b.grade}</td>
                          <td className="py-1.5">{b.min}</td>
                          <td className="py-1.5">{b.max}</td>
                          <td className="py-1.5 text-muted">{b.label ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit ? (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">
            Add grading scale
          </h2>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() =>
                createGradingScaleAction({
                  name,
                  code: code || name,
                  description,
                  bands,
                }),
              );
              setName("");
              setCode("");
              setDescription("");
              setBands(DEFAULT_BANDS);
            }}
          >
            <div className="flex flex-wrap gap-3">
              <Field label="Name" value={name} onChange={setName} />
              <Field
                label="Code"
                value={code}
                onChange={setCode}
                required={false}
              />
              <Field
                label="Description"
                value={description}
                onChange={setDescription}
                required={false}
              />
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead className="bg-surface text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Grade</th>
                    <th className="px-3 py-2 font-medium">Min</th>
                    <th className="px-3 py-2 font-medium">Max</th>
                    <th className="px-3 py-2 font-medium">Label</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {bands.map((b, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1.5">
                        <input
                          value={b.grade}
                          onChange={(e) =>
                            updateBand(i, { grade: e.target.value })
                          }
                          className="h-8 w-16 rounded border border-border bg-background px-2"
                          required
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={b.min}
                          onChange={(e) =>
                            updateBand(i, { min: Number(e.target.value) })
                          }
                          className="h-8 w-20 rounded border border-border bg-background px-2"
                          required
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={b.max}
                          onChange={(e) =>
                            updateBand(i, { max: Number(e.target.value) })
                          }
                          className="h-8 w-20 rounded border border-border bg-background px-2"
                          required
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={b.label ?? ""}
                          onChange={(e) =>
                            updateBand(i, { label: e.target.value })
                          }
                          className="h-8 w-full min-w-[120px] rounded border border-border bg-background px-2"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          className="text-muted hover:text-foreground"
                          onClick={() =>
                            setBands((prev) => prev.filter((_, j) => j !== i))
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="h-10 rounded-lg border border-border px-4 text-sm"
                onClick={() =>
                  setBands((prev) => [
                    ...prev,
                    { min: 0, max: 0, grade: "", label: "" },
                  ])
                }
              >
                Add band
              </button>
              <button
                type="submit"
                disabled={pending || !name.trim() || bands.length === 0}
                className="h-10 rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Saving…" : "Create scale"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <p className="text-sm text-muted">
          You can view grading scales. Ask an admin for catalog edit access to
          add or archive.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <input
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
      />
    </label>
  );
}
