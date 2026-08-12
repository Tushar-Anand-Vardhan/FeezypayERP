"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateTermAction } from "@/lib/calendar/terms-actions";

type TermRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

type Props = {
  academicYearId: string;
  terms: TermRow[];
  termCountLocked: boolean;
  lockReason: string | null;
  canEdit: boolean;
};

export function ConfigTermsEditClient({
  academicYearId,
  terms: initial,
  termCountLocked,
  lockReason,
  canEdit,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [terms, setTerms] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <p className="text-sm text-muted">
        Calendar edit permission is required to change term dates.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {termCountLocked ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {lockReason ??
            "Term count is locked. You can change dates only if no events conflict."}
        </p>
      ) : null}
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

      <ul className="space-y-4">
        {terms.map((t) => (
          <li
            key={t.id}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <div className="mb-3 font-medium">{t.name}</div>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Start
                <input
                  type="date"
                  value={t.start_date}
                  onChange={(e) =>
                    setTerms((prev) =>
                      prev.map((x) =>
                        x.id === t.id
                          ? { ...x, start_date: e.target.value }
                          : x,
                      ),
                    )
                  }
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                End
                <input
                  type="date"
                  value={t.end_date}
                  onChange={(e) =>
                    setTerms((prev) =>
                      prev.map((x) =>
                        x.id === t.id ? { ...x, end_date: e.target.value } : x,
                      ),
                    )
                  }
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={pending}
                className="mt-auto h-10 rounded-lg bg-feezy-indigo px-3 text-sm font-medium text-white disabled:opacity-60"
                onClick={() => {
                  setMessage(null);
                  setError(null);
                  startTransition(async () => {
                    const result = await updateTermAction({
                      id: t.id,
                      academicYearId,
                      name: t.name,
                      startDate: t.start_date,
                      endDate: t.end_date,
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
                Save dates
              </button>
            </div>
          </li>
        ))}
      </ul>

      {terms.length === 0 ? (
        <p className="text-sm text-muted">
          No terms yet. Finish onboarding terms or add them from the calendar
          before count locks.
        </p>
      ) : null}
    </div>
  );
}
