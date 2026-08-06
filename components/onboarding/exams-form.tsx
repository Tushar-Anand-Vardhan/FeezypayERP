"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { FormField } from "@/components/form/form-field";
import { WizardActions } from "@/components/onboarding/wizard-actions";
import {
  getExamsStepDataAction,
  saveExamsAction,
} from "@/lib/onboarding/exams-review-actions";
import {
  EXAM_CATEGORIES,
  GRADING_TYPES,
  emptyExam,
  validateExamRows,
  type ExamFieldErrors,
  type ExamFormRow,
} from "@/lib/onboarding/exams";

export function ExamsForm() {
  const router = useRouter();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [terms, setTerms] = useState<Array<{ id: string; name: string }>>([]);
  const [exams, setExams] = useState<ExamFormRow[]>([]);
  const [fieldErrors, setFieldErrors] = useState<ExamFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"save" | "next" | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setInitialLoading(true);
      const result = await getExamsStepDataAction();
      if (cancelled) return;

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

      setTerms(result.terms);
      setExams(
        result.exams.length > 0
          ? result.exams
          : [{ ...emptyExam(), termId: result.terms[0]?.id ?? "" }],
      );
      setInitialLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function performSave(intent: "save" | "next") {
    setFormError(null);
    setSuccessMessage(null);

    const errors = validateExamRows(exams, {
      requireAtLeastOne: intent === "next",
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});

    const formData = new FormData();
    formData.set("exams", JSON.stringify(exams));
    formData.set("intent", intent);

    const result = await saveExamsAction(formData);
    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      return false;
    }

    setSuccessMessage(result.message);
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  async function handleSaveAndExit() {
    setLoadingAction("save");
    const saved = await performSave("save");
    if (saved) router.push("/dashboard");
    setLoadingAction(null);
  }

  async function handleContinue() {
    setLoadingAction("next");
    const saved = await performSave("next");
    if (saved) router.push("/onboarding/review");
    setLoadingAction(null);
  }

  if (initialLoading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-muted">Loading exams…</p>
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
          <h1 className="text-2xl font-semibold tracking-tight">Exams</h1>
          <p className="text-sm text-muted">Complete Term structure first.</p>
          <Link
            href="/onboarding/terms"
            className="inline-flex text-sm font-medium underline-offset-4 hover:underline"
          >
            Go to Terms
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
            Exam configuration
          </h1>
          <p className="text-sm text-muted">
            Define exams per term with weightage and max marks. Scheduling can
            come later.
          </p>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit} noValidate>
          <section className="space-y-4">
            {exams.map((exam, index) => (
              <div
                key={`exam-${index}`}
                className="space-y-4 rounded-2xl border border-border p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-medium">Exam {index + 1}</h2>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-1.5 text-sm"
                    onClick={() =>
                      setExams((current) =>
                        current.filter((_, rowIndex) => rowIndex !== index),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    id={`exam-${index}-name`}
                    label="Name"
                    value={exam.name}
                    onChange={(value) =>
                      setExams((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, name: value } : row,
                        ),
                      )
                    }
                    error={fieldErrors[`exam-${index}-name`]}
                    required
                  />
                  <div className="space-y-1.5">
                    <label
                      className="text-sm font-medium"
                      htmlFor={`exam-${index}-category`}
                    >
                      Category
                    </label>
                    <select
                      id={`exam-${index}-category`}
                      className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
                      value={exam.category}
                      onChange={(event) =>
                        setExams((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  category: event.target
                                    .value as ExamFormRow["category"],
                                }
                              : row,
                          ),
                        )
                      }
                    >
                      {EXAM_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className="text-sm font-medium"
                      htmlFor={`exam-${index}-term`}
                    >
                      Term
                    </label>
                    <select
                      id={`exam-${index}-term`}
                      className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
                      value={exam.termId}
                      onChange={(event) =>
                        setExams((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, termId: event.target.value }
                              : row,
                          ),
                        )
                      }
                    >
                      <option value="">Select term</option>
                      {terms.map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.name}
                        </option>
                      ))}
                    </select>
                    {fieldErrors[`exam-${index}-termId`] ? (
                      <p className="text-sm text-feezy-coral">
                        {fieldErrors[`exam-${index}-termId`]}
                      </p>
                    ) : null}
                  </div>
                  <FormField
                    id={`exam-${index}-weightage`}
                    label="Weightage %"
                    value={exam.weightagePercent}
                    onChange={(value) =>
                      setExams((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, weightagePercent: value }
                            : row,
                        ),
                      )
                    }
                    error={fieldErrors[`exam-${index}-weightagePercent`]}
                  />
                  <FormField
                    id={`exam-${index}-max`}
                    label="Max marks"
                    value={exam.maxMarks}
                    onChange={(value) =>
                      setExams((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, maxMarks: value } : row,
                        ),
                      )
                    }
                    error={fieldErrors[`exam-${index}-maxMarks`]}
                  />
                  <div className="space-y-1.5">
                    <label
                      className="text-sm font-medium"
                      htmlFor={`exam-${index}-grading`}
                    >
                      Grading type
                    </label>
                    <select
                      id={`exam-${index}-grading`}
                      className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
                      value={exam.gradingType}
                      onChange={(event) =>
                        setExams((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  gradingType: event.target
                                    .value as ExamFormRow["gradingType"],
                                }
                              : row,
                          ),
                        )
                      }
                    >
                      {GRADING_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium"
              onClick={() =>
                setExams((current) => [
                  ...current,
                  { ...emptyExam(), termId: terms[0]?.id ?? "" },
                ])
              }
            >
              Add exam
            </button>
          </section>

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
            backHref="/onboarding/timetable"
            loadingAction={loadingAction}
            onSaveAndExit={handleSaveAndExit}
            onContinue={handleContinue}
          />
        </form>
      </div>
    </main>
  );
}
