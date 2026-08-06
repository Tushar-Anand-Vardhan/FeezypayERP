"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useId, useState } from "react";
import { FormField, formControlClassName } from "@/components/form/form-field";
import { WizardActions } from "@/components/onboarding/wizard-actions";
import {
  getSectionsStepDataAction,
  saveSectionsAction,
} from "@/app/onboarding/actions";
import {
  applyBulkSectionsToEmptyClasses,
  parseBulkSectionNames,
  validateSectionsByClass,
  type ClassSectionsFormRow,
  type SectionFieldErrors,
  type SectionFormRow,
} from "@/lib/onboarding/sections";

type ClassSectionsState = {
  classId: string;
  className: string;
  capacity: string;
  sections: SectionFormRow[];
  newSectionName: string;
};

type SectionModalState = {
  classId: string;
  sectionIndex: number;
} | null;

function toPayload(classes: ClassSectionsState[]): ClassSectionsFormRow[] {
  return classes.map((classRow) => ({
    classId: classRow.classId,
    capacity: classRow.capacity,
    sections: classRow.sections,
  }));
}

function sectionCountLabel(count: number) {
  if (count === 0) {
    return "No sections yet";
  }

  return count === 1 ? "1 section" : `${count} sections`;
}

export function SectionsForm() {
  const router = useRouter();
  const modalTitleId = useId();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [classes, setClasses] = useState<ClassSectionsState[]>([]);
  const [bulkSectionNames, setBulkSectionNames] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SectionFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"save" | "next" | null>(
    null,
  );
  const [sectionModal, setSectionModal] = useState<SectionModalState>(null);
  const [modalName, setModalName] = useState("");
  const [modalCapacity, setModalCapacity] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSectionsStep() {
      setInitialLoading(true);
      setLoadError(null);

      const result = await getSectionsStepDataAction();

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
      setClasses(
        result.classes.map((classRow) => ({
          classId: classRow.id,
          className: classRow.name,
          capacity: classRow.capacity,
          sections: classRow.sections.map((section) => ({
            name: section.name,
            capacity: section.capacity,
          })),
          newSectionName: "",
        })),
      );
      setInitialLoading(false);
    }

    void loadSectionsStep();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateClassCapacity(classId: string, capacity: string) {
    setClasses((current) =>
      current.map((row) =>
        row.classId === classId ? { ...row, capacity } : row,
      ),
    );
  }

  function updateNewSectionName(classId: string, value: string) {
    setClasses((current) =>
      current.map((row) =>
        row.classId === classId ? { ...row, newSectionName: value } : row,
      ),
    );
  }

  function addSection(classId: string) {
    setClasses((current) =>
      current.map((row) => {
        if (row.classId !== classId) {
          return row;
        }

        const trimmed = row.newSectionName.trim();
        if (!trimmed) {
          return row;
        }

        const duplicate = row.sections.some(
          (section) => section.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (duplicate) {
          return row;
        }

        return {
          ...row,
          sections: [...row.sections, { name: trimmed, capacity: "" }],
          newSectionName: "",
        };
      }),
    );
  }

  function handleNewSectionKeyDown(
    classId: string,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      addSection(classId);
    }
  }

  function removeSection(classId: string, sectionIndex: number) {
    setClasses((current) =>
      current.map((row) =>
        row.classId === classId
          ? {
              ...row,
              sections: row.sections.filter((_, index) => index !== sectionIndex),
            }
          : row,
      ),
    );
  }

  function openSectionModal(classId: string, sectionIndex: number) {
    const classRow = classes.find((row) => row.classId === classId);
    const section = classRow?.sections[sectionIndex];
    if (!section) {
      return;
    }

    setModalName(section.name);
    setModalCapacity(section.capacity);
    setModalError(null);
    setSectionModal({ classId, sectionIndex });
  }

  function closeSectionModal() {
    setSectionModal(null);
    setModalError(null);
  }

  function saveSectionModal() {
    if (!sectionModal) {
      return;
    }

    const trimmedName = modalName.trim();
    if (!trimmedName) {
      setModalError("Section name cannot be empty.");
      return;
    }

    const classRow = classes.find((row) => row.classId === sectionModal.classId);
    if (!classRow) {
      return;
    }

    const duplicate = classRow.sections.some(
      (section, index) =>
        index !== sectionModal.sectionIndex &&
        section.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (duplicate) {
      setModalError("This section name already exists in this class.");
      return;
    }

    if (modalCapacity.trim()) {
      const capacity = Number(modalCapacity);
      if (!Number.isInteger(capacity) || capacity <= 0) {
        setModalError("Capacity must be a positive integer.");
        return;
      }
    }

    setClasses((current) =>
      current.map((row) => {
        if (row.classId !== sectionModal.classId) {
          return row;
        }

        return {
          ...row,
          sections: row.sections.map((section, index) =>
            index === sectionModal.sectionIndex
              ? { name: trimmedName, capacity: modalCapacity.trim() }
              : section,
          ),
        };
      }),
    );

    closeSectionModal();
  }

  function applyBulk() {
    const names = parseBulkSectionNames(bulkSectionNames);
    if (names.length === 0) {
      return;
    }

    setClasses((current) => {
      const payload = applyBulkSectionsToEmptyClasses(toPayload(current), names);
      return current.map((row) => {
        const updated = payload.find((item) => item.classId === row.classId);
        return {
          ...row,
          sections: updated?.sections ?? row.sections,
        };
      });
    });
  }

  async function performSave(intent: "save" | "next") {
    setFormError(null);
    setSuccessMessage(null);

    const payload = toPayload(classes);
    const validationErrors = validateSectionsByClass(payload, {
      requireEveryClassHasSection: intent === "next",
    });

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return false;
    }

    setFieldErrors({});

    const formData = new FormData();
    formData.set("sectionsByClass", JSON.stringify(payload));
    formData.set("intent", intent);

    const result = await saveSectionsAction(formData);

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
    const saved = await performSave("save");
    if (saved) {
      router.push("/dashboard");
      router.refresh();
    }
    setLoadingAction(null);
  }

  async function handleContinue() {
    setLoadingAction("next");
    const saved = await performSave("next");
    if (saved) {
      router.push("/onboarding/subjects");
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
        <p className="text-sm text-muted">Loading sections…</p>
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
            Sections
          </h1>
          <p className="text-sm text-muted">Complete Classes first.</p>
          <Link
            href="/onboarding/classes"
            className="inline-flex text-sm font-medium text-feezy-coral underline-offset-4 hover:underline"
          >
            Go to Classes
          </Link>
        </div>
      </main>
    );
  }

  const activeClass = sectionModal
    ? classes.find((row) => row.classId === sectionModal.classId)
    : null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Sections
          </h1>
          <p className="text-sm text-muted">
            Add sections per class. If you set a class capacity, section
            capacities must add up to the same total.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
            <label
              htmlFor="bulkSectionNames"
              className="block text-sm font-medium"
            >
              Bulk fill empty classes
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="bulkSectionNames"
                value={bulkSectionNames}
                onChange={(event) => setBulkSectionNames(event.target.value)}
                placeholder="A, B, C"
                className={formControlClassName}
              />
              <button
                type="button"
                onClick={applyBulk}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold transition hover:bg-surface-strong"
              >
                Apply to empty classes
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Only fills classes that do not have sections yet.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {classes.map((classRow) => {
              const sectionSum = classRow.sections.reduce((sum, section) => {
                const value = Number(section.capacity);
                return Number.isInteger(value) && value > 0 ? sum + value : sum;
              }, 0);

              return (
                <li
                  key={classRow.classId}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm"
                >
                  <div className="space-y-1">
                    <h2 className="font-display text-lg font-semibold tracking-tight">
                      {classRow.className}
                    </h2>
                    <p className="text-xs text-muted">
                      {sectionCountLabel(classRow.sections.length)}
                      {classRow.capacity.trim()
                        ? ` · sections total ${sectionSum || 0} / ${classRow.capacity.trim()}`
                        : ""}
                    </p>
                  </div>

                  <FormField
                    id={`capacity-${classRow.classId}`}
                    label="Class capacity"
                    value={classRow.capacity}
                    onChange={(value) =>
                      updateClassCapacity(classRow.classId, value)
                    }
                    error={fieldErrors[`class-${classRow.classId}-capacity`]}
                  />

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Sections</p>
                    {classRow.sections.length === 0 ? (
                      <p className="text-sm text-muted">No sections yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {classRow.sections.map((section, sectionIndex) => (
                          <button
                            key={`${classRow.classId}-${sectionIndex}-${section.name}`}
                            type="button"
                            onClick={() =>
                              openSectionModal(classRow.classId, sectionIndex)
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-strong px-3 py-1.5 text-sm font-medium transition hover:border-feezy-magenta/40"
                          >
                            <span>{section.name}</span>
                            {section.capacity ? (
                              <span className="text-xs text-muted">
                                {section.capacity}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}
                    {fieldErrors[
                      `class-${classRow.classId}-form`
                    ] ? (
                      <p className="text-sm text-feezy-coral">
                        {fieldErrors[`class-${classRow.classId}-form`]}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label
                        htmlFor={`new-section-${classRow.classId}`}
                        className="mb-2 block text-sm font-medium"
                      >
                        Add section
                      </label>
                      <input
                        id={`new-section-${classRow.classId}`}
                        value={classRow.newSectionName}
                        onChange={(event) =>
                          updateNewSectionName(
                            classRow.classId,
                            event.target.value,
                          )
                        }
                        onKeyDown={(event) =>
                          handleNewSectionKeyDown(classRow.classId, event)
                        }
                        placeholder="A"
                        className={formControlClassName}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => addSection(classRow.classId)}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-feezy-indigo px-4 text-sm font-semibold text-white transition hover:brightness-110"
                    >
                      Add
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {formError ? (
            <p className="text-sm text-feezy-coral">{formError}</p>
          ) : null}
          {successMessage ? (
            <p className="text-sm text-emerald-600">{successMessage}</p>
          ) : null}

          <WizardActions
            backHref="/onboarding/classes"
            loadingAction={loadingAction}
            onSaveAndExit={handleSaveAndExit}
            onContinue={handleContinue}
          />
        </form>
      </div>

      {sectionModal && activeClass ? (
        <div
          className="feezy-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4"
          role="presentation"
          onClick={closeSectionModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            className="feezy-modal-panel w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id={modalTitleId}
              className="font-display text-xl font-semibold tracking-tight"
            >
              Edit section · {activeClass.className}
            </h2>
            <div className="mt-5 space-y-4">
              <FormField
                id="modal-section-name"
                label="Section name"
                value={modalName}
                onChange={setModalName}
                required
              />
              <FormField
                id="modal-section-capacity"
                label="Section capacity"
                value={modalCapacity}
                onChange={setModalCapacity}
              />
              {modalError ? (
                <p className="text-sm text-feezy-coral">{modalError}</p>
              ) : null}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  removeSection(sectionModal.classId, sectionModal.sectionIndex);
                  closeSectionModal();
                }}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-feezy-coral transition hover:bg-surface-strong"
              >
                Remove section
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeSectionModal}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold transition hover:bg-surface-strong"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveSectionModal}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-feezy-magenta px-4 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Save section
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
