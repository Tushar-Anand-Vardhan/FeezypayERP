"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { FormField } from "@/components/form/form-field";
import { WizardActions } from "@/components/onboarding/wizard-actions";
import { useOnboardingStepReady } from "@/components/onboarding/onboarding-progress";
import {
  getClassesStepDataAction,
  saveClassesAction,
} from "@/app/onboarding/actions";
import {
  appendUniqueClassRows,
  CLASS_PRESET_1_10,
  CLASS_PRESET_1_12,
  CLASS_PRESET_NURSERY_12,
  validateClassRows,
  type ClassFieldErrors,
  type ClassFormRow,
} from "@/lib/onboarding/classes";

export function ClassesForm() {
  const router = useRouter();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [classes, setClasses] = useState<ClassFormRow[]>([]);
  const [savedSectionCountByClassId, setSavedSectionCountByClassId] = useState<
    Record<string, number>
  >({});
  const [newClassName, setNewClassName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ClassFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"save" | "next" | null>(
    null,
  );
  useOnboardingStepReady(!initialLoading);

  useEffect(() => {
    let cancelled = false;

    async function loadClassesStep() {
      setInitialLoading(true);
      setLoadError(null);

      const result = await getClassesStepDataAction();

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
      setClasses(result.classes);
      setSavedSectionCountByClassId(result.sectionCountByClassId);
      setInitialLoading(false);
    }

    void loadClassesStep();

    return () => {
      cancelled = true;
    };
  }, []);

  function addClassName(rawName: string) {
    const trimmed = rawName.trim();

    if (!trimmed) {
      setFieldErrors((current) => ({
        ...current,
        newClassName: "Class name cannot be empty.",
      }));
      return;
    }

    const duplicateIndex = classes.findIndex(
      (row) => row.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );

    if (duplicateIndex >= 0) {
      setFieldErrors((current) => ({
        ...current,
        newClassName: "This class name already exists in your list.",
        [`class-${duplicateIndex}`]: "This class name duplicates another.",
      }));
      return;
    }

    setClasses((current) => [...current, { name: trimmed }]);
    setNewClassName("");
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.newClassName;
      return next;
    });
  }

  function handleNewClassKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addClassName(newClassName);
    }
  }

  function removeClass(index: number) {
    const classRow = classes[index];
    const savedSectionCount = classRow.id
      ? (savedSectionCountByClassId[classRow.id] ?? 0)
      : 0;

    if (savedSectionCount > 0) {
      const confirmed = window.confirm(
        `This class has ${savedSectionCount} section(s). Removing it will also delete those sections. Continue?`,
      );
      if (!confirmed) {
        return;
      }
    }

    setClasses((current) => current.filter((_, rowIndex) => rowIndex !== index));
    if (classRow.id) {
      setSavedSectionCountByClassId((current) => {
        const next = { ...current };
        delete next[classRow.id!];
        return next;
      });
    }
    setFieldErrors((current) => {
      const next: ClassFieldErrors = {};
      for (const [key, value] of Object.entries(current)) {
        if (key === "newClassName" || key === "form") {
          next[key] = value;
        }
      }
      return next;
    });
  }

  function moveClass(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= classes.length) {
      return;
    }

    setClasses((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function applyPreset(preset: string[]) {
    setClasses((current) => appendUniqueClassRows(current, preset));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.form;
      return next;
    });
  }

  async function performSave(intent: "save" | "next") {
    setFormError(null);
    setSuccessMessage(null);

    const validationErrors = validateClassRows(classes, {
      requireAtLeastOne: intent === "next",
    });

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return false;
    }

    setFieldErrors({});

    const formData = new FormData();
    formData.set("classes", JSON.stringify(classes));
    formData.set("intent", intent);

    const result = await saveClassesAction(formData);

    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
      return false;
    }

    setSuccessMessage(result.message);

    const reload = await getClassesStepDataAction();
    if (reload.success && !reload.blocked) {
      setClasses(reload.classes);
      setSavedSectionCountByClassId(reload.sectionCountByClassId);
    }

    return true;
  }

  async function handleSaveAndExit() {
    setLoadingAction("save");
    const saved = await performSave("save");
    if (saved) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setLoadingAction(null);
  }

  async function handleContinue() {
    setLoadingAction("next");
    const saved = await performSave("next");
    if (saved) {
      router.push("/onboarding/sections");
      return;
    }
    setLoadingAction(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleContinue();
  }

  if (initialLoading) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-muted">Loading classes…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-feezy-coral">{loadError}</p>
      </main>
    );
  }

  if (blocked) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Classes
          </h1>
          <p className="text-sm text-muted">Complete Term Structure first.</p>
          <Link
            href="/onboarding/terms"
            className="inline-flex text-sm font-medium text-feezy-coral underline-offset-4 hover:underline"
          >
            Go to Term Structure
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Classes
          </h1>
          <p className="text-sm text-muted">
            Add the grades your school runs. Use a quick pick or add them one by
            one.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Quick picks</legend>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "1–10", preset: CLASS_PRESET_1_10 },
                { label: "1–12", preset: CLASS_PRESET_1_12 },
                { label: "Nursery–12", preset: CLASS_PRESET_NURSERY_12 },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => applyPreset(item.preset)}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-feezy-magenta/40 hover:text-foreground"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <FormField
                  id="newClassName"
                  label="Add a class"
                  value={newClassName}
                  onChange={setNewClassName}
                  onKeyDown={handleNewClassKeyDown}
                  error={fieldErrors.newClassName}
                  describedBy="newClassName-help"
                />
              </div>
              <button
                type="button"
                onClick={() => addClassName(newClassName)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-feezy-indigo px-4 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Add
              </button>
            </div>
            <p id="newClassName-help" className="text-xs text-muted">
              Press Enter or click Add.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-medium">Your classes</h2>
            {classes.length === 0 ? (
              <p className="text-sm text-muted">No classes added yet.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {classes.map((classRow, index) => (
                  <li
                    key={classRow.id ?? `new-${index}-${classRow.name}`}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        {classRow.name}
                      </p>
                      {fieldErrors[`class-${index}`] ? (
                        <p className="text-sm text-feezy-coral">
                          {fieldErrors[`class-${index}`]}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-auto flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Move ${classRow.name} earlier`}
                        disabled={index === 0}
                        onClick={() => moveClass(index, -1)}
                        className="rounded-lg border border-border px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${classRow.name} later`}
                        disabled={index === classes.length - 1}
                        onClick={() => moveClass(index, 1)}
                        className="rounded-lg border border-border px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${classRow.name}`}
                        onClick={() => removeClass(index)}
                        className="rounded-lg border border-border px-2 py-1 text-sm"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
            backHref="/onboarding/terms"
            loadingAction={loadingAction}
            onSaveAndExit={handleSaveAndExit}
            onContinue={handleContinue}
          />
        </form>
      </div>
    </main>
  );
}
