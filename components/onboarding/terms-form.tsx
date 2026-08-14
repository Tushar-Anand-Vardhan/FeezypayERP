"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormField, FormSelect, formControlClassName } from "@/components/form/form-field";
import { WizardActions } from "@/components/onboarding/wizard-actions";
import { useOnboardingStepReady } from "@/components/onboarding/onboarding-progress";
import { getTermsStepDataAction, saveTermsAction } from "@/app/onboarding/actions";
import { MONTH_OPTIONS } from "@/lib/onboarding/school-identity";
import {
  daysInMonth,
  validateTermsForm,
  type TermFieldErrors,
  type TermFormRow,
} from "@/lib/onboarding/terms";

type TermCountMode = "2" | "3" | "custom";

function createTermRows(count: number, existing: TermFormRow[] = []): TermFormRow[] {
  return Array.from({ length: count }, (_, index) => ({
    name: existing[index]?.name ?? `Term ${index + 1}`,
    startMonth: existing[index]?.startMonth ?? "",
    startDay: existing[index]?.startDay ?? "",
    endMonth: existing[index]?.endMonth ?? "",
    endDay: existing[index]?.endDay ?? "",
  }));
}

function inferTermCountMode(count: number): {
  mode: TermCountMode;
  customCount: number;
} {
  if (count === 2) {
    return { mode: "2", customCount: 2 };
  }
  if (count === 3) {
    return { mode: "3", customCount: 3 };
  }
  return { mode: "custom", customCount: Math.min(Math.max(count, 1), 12) };
}

function dayOptionsForMonth(monthValue: string) {
  const month = Number(monthValue);
  const count =
    !monthValue || Number.isNaN(month) || month < 1 || month > 12
      ? 31
      : daysInMonth(month);
  return Array.from({ length: count }, (_, index) => String(index + 1));
}

export function TermsForm() {
  const router = useRouter();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [academicYearLabel, setAcademicYearLabel] = useState("");
  const [academicYearStartMonth, setAcademicYearStartMonth] = useState(4);
  const [termCountMode, setTermCountMode] = useState<TermCountMode>("2");
  const [customTermCount, setCustomTermCount] = useState(2);
  const [terms, setTerms] = useState<TermFormRow[]>(createTermRows(2));
  const [whatsappReportFollowsTerms, setWhatsappReportFollowsTerms] =
    useState(true);
  const [fieldErrors, setFieldErrors] = useState<TermFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"save" | "next" | null>(
    null,
  );
  useOnboardingStepReady(!initialLoading);

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
      setAcademicYearStartMonth(result.academicYearStartMonth);
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
    const count =
      mode === "2" ? 2 : mode === "3" ? 3 : Math.min(Math.max(customCount, 1), 12);
    setTermCountMode(mode);
    setCustomTermCount(count);
    setTerms((current) => createTermRows(count, current));
  }

  function updateTerm(index: number, key: keyof TermFormRow, value: string) {
    setTerms((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row;
        }

        const next = { ...row, [key]: value };

        if (key === "startMonth" && next.startDay) {
          const max = daysInMonth(Number(value) || 1);
          if (Number(next.startDay) > max) {
            next.startDay = String(max);
          }
        }

        if (key === "endMonth" && next.endDay) {
          const max = daysInMonth(Number(value) || 1);
          if (Number(next.endDay) > max) {
            next.endDay = String(max);
          }
        }

        return next;
      }),
    );
  }

  async function performSave() {
    setFormError(null);
    setSuccessMessage(null);

    const validationErrors = validateTermsForm(terms, academicYearStartMonth);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return false;
    }

    setFieldErrors({});

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
      return false;
    }

    setSuccessMessage(result.message);
    return true;
  }

  async function handleSaveAndExit() {
    setLoadingAction("save");
    const saved = await performSave();
    if (saved) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setLoadingAction(null);
  }

  async function handleContinue() {
    setLoadingAction("next");
    const saved = await performSave();
    if (saved) {
      router.push("/onboarding/classes");
      return;
    }
    setLoadingAction(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleContinue();
  }

  const startMonthLabel =
    MONTH_OPTIONS.find((month) => month.value === academicYearStartMonth)
      ?.label ?? String(academicYearStartMonth);

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
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Term structure
          </h1>
          <p className="text-sm text-muted">
            Complete School Identity first to set your academic year.
          </p>
          <Link
            href="/onboarding/school-identity"
            className="inline-flex text-sm font-medium text-feezy-coral underline-offset-4 hover:underline"
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
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Term structure
          </h1>
          <p className="text-sm text-muted">
            Set recurring term dates for{" "}
            <span className="font-medium text-foreground">{academicYearLabel}</span>.
            Use month and day only — the same pattern applies every year. Your
            year starts in{" "}
            <span className="font-medium text-foreground">{startMonthLabel}</span>.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
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
                      ? "bg-feezy-indigo text-white"
                      : "border border-border text-muted hover:border-feezy-magenta/40"
                  }`}
                >
                  {mode === "2" ? "2 terms" : mode === "3" ? "3 terms" : "Custom"}
                </button>
              ))}
            </div>
            {termCountMode === "custom" ? (
              <div className="max-w-xs space-y-2">
                <label
                  htmlFor="customTermCount"
                  className="block text-sm font-medium"
                >
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
                    applyTermCount(
                      "custom",
                      Number.isNaN(nextCount) ? 1 : nextCount,
                    );
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
                className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm"
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormSelect
                    id={`term-${index}-startMonth`}
                    label="Start month"
                    value={term.startMonth}
                    onChange={(value) => updateTerm(index, "startMonth", value)}
                    error={fieldErrors[`term-${index}-startMonth`]}
                    placeholder="Month"
                    required
                  >
                    {MONTH_OPTIONS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </FormSelect>
                  <FormSelect
                    id={`term-${index}-startDay`}
                    label="Start day"
                    value={term.startDay}
                    onChange={(value) => updateTerm(index, "startDay", value)}
                    error={fieldErrors[`term-${index}-startDay`]}
                    placeholder="Day"
                    required
                  >
                    {dayOptionsForMonth(term.startMonth).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </FormSelect>
                  <FormSelect
                    id={`term-${index}-endMonth`}
                    label="End month"
                    value={term.endMonth}
                    onChange={(value) => updateTerm(index, "endMonth", value)}
                    error={fieldErrors[`term-${index}-endMonth`]}
                    placeholder="Month"
                    required
                  >
                    {MONTH_OPTIONS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </FormSelect>
                  <FormSelect
                    id={`term-${index}-endDay`}
                    label="End day"
                    value={term.endDay}
                    onChange={(value) => updateTerm(index, "endDay", value)}
                    error={fieldErrors[`term-${index}-endDay`]}
                    placeholder="Day"
                    required
                  >
                    {dayOptionsForMonth(term.endMonth).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </FormSelect>
                </div>
              </div>
            ))}
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
            <input
              type="checkbox"
              checked={whatsappReportFollowsTerms}
              onChange={(event) =>
                setWhatsappReportFollowsTerms(event.target.checked)
              }
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
            <p className="text-sm text-emerald-600">{successMessage}</p>
          ) : null}

          <WizardActions
            backHref="/onboarding/school-identity"
            loadingAction={loadingAction}
            onSaveAndExit={handleSaveAndExit}
            onContinue={handleContinue}
          />
        </form>
      </div>
    </main>
  );
}
