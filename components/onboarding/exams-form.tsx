"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FormField } from "@/components/form/form-field";
import { WizardActions } from "@/components/onboarding/wizard-actions";
import { useOnboardingStepReady } from "@/components/onboarding/onboarding-progress";
import {
  getExamsStepDataAction,
  saveExamsAction,
} from "@/lib/onboarding/exams-review-actions";
import {
  EXAM_CATEGORIES,
  GRADING_TYPES,
  copyExamsToClass,
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
  const [blockedReason, setBlockedReason] = useState<
    "prerequisites" | "terms" | "classes" | null
  >(null);
  const [terms, setTerms] = useState<Array<{ id: string; name: string }>>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [exams, setExams] = useState<ExamFormRow[]>([]);
  const [activeClassId, setActiveClassId] = useState("");
  const [copyFromClassId, setCopyFromClassId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ExamFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"save" | "next" | null>(
    null,
  );
  useOnboardingStepReady(!initialLoading);

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
        setBlockedReason(result.reason);
        setInitialLoading(false);
        return;
      }

      setTerms(result.terms);
      setClasses(result.classes);
      setExams(result.exams);
      setActiveClassId(result.classes[0]?.id ?? "");
      setInitialLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const examCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const exam of exams) {
      counts.set(exam.classId, (counts.get(exam.classId) ?? 0) + 1);
    }
    return counts;
  }, [exams]);

  const classExamRows = useMemo(
    () =>
      exams
        .map((exam, index) => ({ exam, index }))
        .filter(({ exam }) => exam.classId === activeClassId),
    [exams, activeClassId],
  );

  const activeClass = classes.find((row) => row.id === activeClassId);
  const copySources = classes.filter(
    (row) => row.id !== activeClassId && (examCounts.get(row.id) ?? 0) > 0,
  );

  function updateExam(index: number, patch: Partial<ExamFormRow>) {
    setExams((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  async function performSave(intent: "save" | "next") {
    setFormError(null);
    setSuccessMessage(null);

    const errors = validateExamRows(exams, {
      requireAtLeastOne: intent === "next",
      classIds: new Set(classes.map((row) => row.id)),
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstInvalid = exams.findIndex((_, index) =>
        Boolean(
          errors[`exam-${index}-classId`] ||
            errors[`exam-${index}-name`] ||
            errors[`exam-${index}-termId`] ||
            errors[`exam-${index}-weightagePercent`] ||
            errors[`exam-${index}-maxMarks`],
        ),
      );
      if (firstInvalid >= 0) {
        setActiveClassId(exams[firstInvalid]?.classId ?? activeClassId);
      }
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
    if (saved) {
      router.push("/dashboard");
      return;
    }
    setLoadingAction(null);
  }

  async function handleContinue() {
    setLoadingAction("next");
    const saved = await performSave("next");
    if (saved) {
      router.push("/onboarding/review");
      return;
    }
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
    const blockedCopy =
      blockedReason === "classes"
        ? {
            message: "Add at least one class before configuring exams.",
            href: "/onboarding/classes",
            label: "Go to Classes",
          }
        : blockedReason === "prerequisites"
          ? {
              message:
                "Finish school identity and earlier setup before configuring exams.",
              href: "/onboarding/school-identity",
              label: "Go to School Identity",
            }
          : {
              message: "Complete Term structure first.",
              href: "/onboarding/terms",
              label: "Go to Terms",
            };

    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Exams</h1>
          <p className="text-sm text-muted">{blockedCopy.message}</p>
          <Link
            href={blockedCopy.href}
            className="inline-flex text-sm font-medium underline-offset-4 hover:underline"
          >
            {blockedCopy.label}
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
            Each class can have its own exam pattern. Switch class, then add
            unit tests, midterms, or boards for that class only. Names must be
            unique within the class. You do not have to set exams for every
            class.
          </p>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-wrap gap-2">
            {classes.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setActiveClassId(row.id);
                  setCopyFromClassId("");
                }}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  activeClassId === row.id
                    ? "bg-feezy-indigo text-white"
                    : "border border-border text-muted"
                }`}
              >
                {row.name}
                {(examCounts.get(row.id) ?? 0) > 0
                  ? ` · ${examCounts.get(row.id)}`
                  : ""}
              </button>
            ))}
          </div>

          <section className="space-y-4">
            {activeClass ? (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-medium">
                    {activeClass.name} exams
                  </h2>
                  <p className="text-xs text-muted">
                    {classExamRows.length === 0
                      ? "No exams yet for this class."
                      : `${classExamRows.length} exam${classExamRows.length === 1 ? "" : "s"} for this class.`}
                  </p>
                </div>
                {copySources.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
                      value={copyFromClassId}
                      onChange={(event) =>
                        setCopyFromClassId(event.target.value)
                      }
                      aria-label="Copy exams from another class"
                    >
                      <option value="">Copy from class…</option>
                      {copySources.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name} ({examCounts.get(row.id)})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
                      disabled={!copyFromClassId}
                      onClick={() => {
                        if (!copyFromClassId || !activeClassId) return;
                        setExams((current) =>
                          copyExamsToClass(
                            current,
                            copyFromClassId,
                            activeClassId,
                          ),
                        );
                        setCopyFromClassId("");
                      }}
                    >
                      Copy
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {classExamRows.map(({ exam, index }, localIndex) => (
              <div
                key={`exam-${index}`}
                className="space-y-4 rounded-2xl border border-border p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-medium">Exam {localIndex + 1}</h2>
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
                    onChange={(value) => updateExam(index, { name: value })}
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
                        updateExam(index, {
                          category: event.target
                            .value as ExamFormRow["category"],
                        })
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
                        updateExam(index, { termId: event.target.value })
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
                      updateExam(index, { weightagePercent: value })
                    }
                    error={fieldErrors[`exam-${index}-weightagePercent`]}
                  />
                  <FormField
                    id={`exam-${index}-max`}
                    label="Max marks"
                    value={exam.maxMarks}
                    onChange={(value) =>
                      updateExam(index, { maxMarks: value })
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
                        updateExam(index, {
                          gradingType: event.target
                            .value as ExamFormRow["gradingType"],
                        })
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
                  emptyExam({
                    classId: activeClassId,
                    termId: terms[0]?.id ?? "",
                  }),
                ])
              }
            >
              Add exam{activeClass ? ` for ${activeClass.name}` : ""}
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
