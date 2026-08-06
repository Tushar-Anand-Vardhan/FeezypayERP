"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { OrderedNameList } from "@/components/onboarding/chip-list";
import { FormField } from "@/components/form/form-field";
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
  const [academicYearLabel, setAcademicYearLabel] = useState("");
  const [classes, setClasses] = useState<ClassFormRow[]>([]);
  const [savedSectionCountByClassId, setSavedSectionCountByClassId] = useState<
    Record<string, number>
  >({});
  const [newClassName, setNewClassName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ClassFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"save" | "next" | null>(null);

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
      setAcademicYearLabel(result.academicYearLabel);
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

  function handleAddClass() {
    addClassName(newClassName);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAction("save");
    await performSave("save");
    setLoadingAction(null);
  }

  async function handleNext() {
    setLoadingAction("next");
    const saved = await performSave("next");
    if (saved) {
      router.push("/onboarding/sections");
    }
    setLoadingAction(null);
  }

  if (initialLoading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-muted">Loading classes…</p>
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
          <h1 className="text-2xl font-semibold tracking-tight">Classes</h1>
          <p className="text-sm text-muted">
            Complete Term Structure first.
          </p>
          <Link
            href="/onboarding/terms"
            className="inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Go to Term Structure
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Classes</h1>
          <p className="text-sm text-muted">
            Add the classes for academic year{" "}
            <span className="font-medium text-foreground">{academicYearLabel}</span>.
            You can save partial progress and come back later. Display order is saved
            as zero-based positions (0, 1, 2, …).
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Quick picks</legend>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => applyPreset(CLASS_PRESET_1_10)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-border"
              >
                1–10
              </button>
              <button
                type="button"
                onClick={() => applyPreset(CLASS_PRESET_1_12)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-border"
              >
                1–12
              </button>
              <button
                type="button"
                onClick={() => applyPreset(CLASS_PRESET_NURSERY_12)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-border"
              >
                Nursery–12
              </button>
            </div>
          </fieldset>

          <OrderedNameList
            items={classes.map((row) => row.name)}
            newItemValue={newClassName}
            onNewItemValueChange={setNewClassName}
            onAddItem={handleAddClass}
            onNewItemKeyDown={handleNewClassKeyDown}
            onMoveItem={moveClass}
            onRemoveItem={removeClass}
            fieldErrors={fieldErrors}
            addFieldId="newClassName"
            addFieldLabel="Add a class"
            addFieldErrorKey="newClassName"
            itemErrorKeyPrefix="class"
            listLabel="Class list"
            emptyMessage="No classes added yet."
            addHelpText="Press Enter or click Add to append a chip."
            renderAddField={(props) => (
              <FormField
                id={props.id}
                label={props.label}
                value={props.value}
                onChange={props.onChange}
                onKeyDown={props.onKeyDown}
                error={props.error}
                describedBy={props.describedBy}
              />
            )}
          />

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
              href="/onboarding/terms"
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-strong"
            >
              Back
            </Link>
            <SubmitButton loading={loadingAction === "save"}>
              Save classes
            </SubmitButton>
            <SubmitButton
              type="button"
              loading={loadingAction === "next"}
              disabled={loadingAction === "save"}
              onClick={handleNext}
            >
              Next
            </SubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}
