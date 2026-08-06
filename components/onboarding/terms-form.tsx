"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { FormField } from "@/components/form/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { formControlClassName } from "@/components/form/form-field";
import { getTermsStepDataAction, saveTermsAction } from "@/app/onboarding/actions";
import {
  validateTermsForm,
  type TermFieldErrors,
  type TermFormRow,
} from "@/lib/onboarding/terms";

type TermCountMode = "2" | "3" | "custom";

function createTermRows(count: number, existing: TermFormRow[] = []): TermFormRow[] {
  return Array.from({ length: count }, (_, index) => ({
    name: existing[index]?.name ?? `Term ${index + 1}`,
    startDate: existing[index]?.startDate ?? "",
    endDate: existing[index]?.endDate ?? "",
  }));
}

function inferTermCountMode(count: number): { mode: TermCountMode; customCount: number } {
  if (count === 2) {
    return { mode: "2", customCount: 2 };
  }
  if (count === 3) {
    return { mode: "3", customCount: 3 };
  }
  return { mode: "custom", customCount: Math.min(Math.max(count, 1), 12) };
}

export function TermsForm() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [academicYearLabel, setAcademicYearLabel] = useState("");
  const [termCountMode, setTermCountMode] = useState<TermCountMode>("2");
  const [customTermCount, setCustomTermCount] = useState(2);
  const [terms, setTerms] = useState<TermFormRow[]>(createTermRows(2));
  const [whatsappReportFollowsTerms, setWhatsappReportFollowsTerms] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<TermFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTermsStep() {
      setInitialLoading(true);
      setLoadError(null);

      const result = await getTermsStepDataAction();

      if (cancelled) {
        return;
      }

      if (!result.success) {
        setLoadError(result.error);
        setInitialLoading(false);
        return;
      }

      if (result.blocked) {
        setBlocked(true);
        setInitialLoading(false);
        return;
      }

      setBlocked(false);
      setAcademicYearLabel(result.academicYearLabel);
      setWhatsappReportFollowsTerms(result.whatsappReportFollowsTerms);

      const existingTerms =
        result.terms.length > 0 ? result.terms : createTermRows(2);
      const { mode, customCount } = inferTermCountMode(existingTerms.length);

      setTermCountMode(mode);
      setCustomTermCount(customCount);
      setTerms(createTermRows(customCount, existingTerms));
      setInitialLoading(false);
    }

    void loadTermsStep();

    return () => {
      cancelled = true;
    };
  }, []);

  function applyTermCount(mode: TermCountMode, customCount = customTermCount) {
    const count = mode === "2" ? 2 : mode === "3" ? 3 : Math.min(Math.max(customCount, 1), 12);
    setTermCountMode(mode);
    setCustomTermCount(count);
    setTerms((current) => createTermRows(count, current));
  }

  function updateTerm(index: number, key: keyof TermFormRow, value: string) {
    setTerms((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const validationErrors = validateTermsForm(terms);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    const formData = new FormData();
    formData.set("terms", JSON.stringify(terms));
    formData.set(
      "whatsappReportFollowsTerms",
      whatsappReportFollowsTerms ? "true" : "false",
    );

    const result = await saveTermsAction(formData);

    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
      setLoading(false);
      return;
    }

    setSuccessMessage(result.message);
    setLoading(false);
  }

  if (initialLoading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-muted">Loading term structure…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-feezy-coral">{loadError}</p>
      </main>
    );
  }

  if (blocked) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Term structure</h1>
          <p className="text-sm text-muted">
            Complete School Identity first to set your academic year.
          </p>
          <Link
            href="/onboarding/school-identity"
            className="inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Go to School Identity
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Term structure</h1>
          <p className="text-sm text-muted">
            Define the terms for academic year{" "}
            <span className="font-medium text-foreground">{academicYearLabel}</span>.
            You can save partial progress and come back later.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSave} noValidate>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Number of terms</legend>
            <div className="flex flex-wrap gap-3">
              {(["2", "3", "custom"] as TermCountMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => applyTermCount(mode)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    termCountMode === mode
                      ? "bg-foreground text-background"
                      : "border border-border text-muted hover:border-border"
                  }`}
                >
                  {mode === "2" ? "2 terms" : mode === "3" ? "3 terms" : "Custom"}
                </button>
              ))}
            </div>
            {termCountMode === "custom" ? (
              <div className="max-w-xs space-y-2">
                <label htmlFor="customTermCount" className="block text-sm font-medium">
                  Custom term count
                </label>
                <input
                  id="customTermCount"
                  type="number"
                  min={1}
                  max={12}
                  value={customTermCount}
                  onChange={(event) => {
                    const nextCount = Number(event.target.value);
                    applyTermCount("custom", Number.isNaN(nextCount) ? 1 : nextCount);
                  }}
                  className={formControlClassName}
                />
              </div>
            ) : null}
          </fieldset>

          <div className="space-y-6">
            {terms.map((term, index) => (
              <div
                key={`term-${index}`}
                className="space-y-4 rounded-2xl border border-border p-5"
              >
                <h2 className="text-base font-medium">Term {index + 1}</h2>
                <FormField
                  id={`term-${index}-name`}
                  label="Term name"
                  value={term.name}
                  onChange={(value) => updateTerm(index, "name", value)}
                  error={fieldErrors[`term-${index}-name`]}
                  required
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField
                    id={`term-${index}-startDate`}
                    label="Start date"
                    type="date"
                    value={term.startDate}
                    onChange={(value) => updateTerm(index, "startDate", value)}
                    error={fieldErrors[`term-${index}-startDate`]}
                    required
                  />
                  <FormField
                    id={`term-${index}-endDate`}
                    label="End date"
                    type="date"
                    value={term.endDate}
                    onChange={(value) => updateTerm(index, "endDate", value)}
                    error={fieldErrors[`term-${index}-endDate`]}
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-border p-4">
            <input
              type="checkbox"
              checked={whatsappReportFollowsTerms}
              onChange={(event) => setWhatsappReportFollowsTerms(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <span className="text-sm text-muted">
              WhatsApp report schedules should follow the term calendar.
            </span>
          </label>

          {fieldErrors.form ? (
            <p className="text-sm text-feezy-coral">{fieldErrors.form}</p>
          ) : null}

          {formError ? (
            <p className="text-sm text-feezy-coral">{formError}</p>
          ) : null}

          {successMessage ? (
            <p className="text-sm text-emerald-600">
              {successMessage}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/onboarding/school-identity"
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-strong"
            >
              Back
            </Link>
            <SubmitButton loading={loading}>Save term structure</SubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}
