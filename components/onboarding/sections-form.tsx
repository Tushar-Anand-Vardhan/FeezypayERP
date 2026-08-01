"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { ChipListRow } from "@/components/onboarding/chip-list";
import { FormField, formControlClassName } from "@/components/form/form-field";
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

function capacitySummary(capacity: string) {
  const trimmed = capacity.trim();
  return trimmed ? `Capacity: ${trimmed}` : "No capacity set";
}

export function SectionsForm() {
  const router = useRouter();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [academicYearLabel, setAcademicYearLabel] = useState("");
  const [classes, setClasses] = useState<ClassSectionsState[]>([]);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [bulkSectionNames, setBulkSectionNames] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SectionFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"save" | "next" | null>(null);

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
      setAcademicYearLabel(result.academicYearLabel);
      setClasses(
        result.classes.map((classRow) => ({
          classId: classRow.id,
          className: classRow.name,
          capacity: classRow.capacity,
          sections: classRow.sections,
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

  function updateClassSections(
    classId: string,
    updater: (current: ClassSectionsState) => ClassSectionsState,
  ) {
    setClasses((current) =>
      current.map((classRow) =>
        classRow.classId === classId ? updater(classRow) : classRow,
      ),
    );
  }

  function toggleClass(classId: string) {
    setExpandedClassId((current) => (current === classId ? null : classId));
  }

  function addSection(classId: string, rawName: string) {
    const trimmed = rawName.trim();

    if (!trimmed) {
      setFieldErrors((current) => ({
        ...current,
        [`class-${classId}-newSectionName`]: "Section name cannot be empty.",
      }));
      return;
    }

    updateClassSections(classId, (classRow) => {
      const duplicateIndex = classRow.sections.findIndex(
        (section) => section.name.trim().toLowerCase() === trimmed.toLowerCase(),
      );

      if (duplicateIndex >= 0) {
        setFieldErrors((current) => ({
          ...current,
          [`class-${classId}-newSectionName`]:
            "This section name already exists for this class.",
          [`class-${classId}-section-${duplicateIndex}-name`]:
            "This section name duplicates another in this class.",
        }));
        return classRow;
      }

      setFieldErrors((current) => {
        const next = { ...current };
        delete next[`class-${classId}-newSectionName`];
        return next;
      });

      return {
        ...classRow,
        sections: [...classRow.sections, { name: trimmed }],
        newSectionName: "",
      };
    });
  }

  function renameSection(classId: string, index: number, nextName: string) {
    updateClassSections(classId, (classRow) => ({
      ...classRow,
      sections: classRow.sections.map((section, rowIndex) =>
        rowIndex === index ? { ...section, name: nextName } : section,
      ),
    }));
  }

  function removeSection(classId: string, index: number) {
    updateClassSections(classId, (classRow) => ({
      ...classRow,
      sections: classRow.sections.filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function moveSection(classId: string, index: number, direction: -1 | 1) {
    updateClassSections(classId, (classRow) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= classRow.sections.length) {
        return classRow;
      }

      const nextSections = [...classRow.sections];
      [nextSections[index], nextSections[targetIndex]] = [
        nextSections[targetIndex],
        nextSections[index],
      ];

      return { ...classRow, sections: nextSections };
    });
  }

  function applyBulkSections() {
    const names = parseBulkSectionNames(bulkSectionNames);
    if (names.length === 0) {
      setFieldErrors((current) => ({
        ...current,
        bulkSectionNames: "Enter at least one section name.",
      }));
      return;
    }

    setFieldErrors((current) => {
      const next = { ...current };
      delete next.bulkSectionNames;
      return next;
    });

    setClasses((current) => {
      const payload = applyBulkSectionsToEmptyClasses(toPayload(current), names);
      return current.map((classRow, index) => ({
        ...classRow,
        sections: payload[index]?.sections ?? classRow.sections,
      }));
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
      router.push("/onboarding/subjects");
    }
    setLoadingAction(null);
  }

  if (initialLoading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-foreground/70">Loading sections…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      </main>
    );
  }

  if (blocked) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="space-y-4 rounded-2xl border border-foreground/10 bg-background p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Sections</h1>
          <p className="text-sm text-foreground/70">Complete Classes first.</p>
          <Link
            href="/onboarding/classes"
            className="inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Go to Classes
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sections</h1>
          <p className="text-sm text-foreground/70">
            Academic year{" "}
            <span className="font-medium text-foreground">{academicYearLabel}</span>.
            Bulk-apply is a one-time fill shortcut only; every section stays fully
            editable after that.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
          <div className="space-y-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label htmlFor="bulkSectionNames" className="sr-only">
                Apply same sections to every class
              </label>
              <span className="text-sm font-medium sm:whitespace-nowrap">
                Apply same sections to every class
              </span>
              <input
                id="bulkSectionNames"
                type="text"
                value={bulkSectionNames}
                onChange={(event) => setBulkSectionNames(event.target.value)}
                placeholder="A, B, C"
                className={`${formControlClassName} flex-1`}
                aria-invalid={Boolean(fieldErrors.bulkSectionNames)}
              />
              <button
                type="button"
                onClick={applyBulkSections}
                className="inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
              >
                Apply
              </button>
            </div>
            <p className="text-xs text-foreground/60">
              Fills only classes with no sections yet.
            </p>
            {fieldErrors.bulkSectionNames ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {fieldErrors.bulkSectionNames}
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            {classes.map((classRow) => {
              const isExpanded = expandedClassId === classRow.classId;
              const sectionCount = classRow.sections.length;

              return (
                <section
                  key={classRow.classId}
                  className="overflow-hidden rounded-2xl border border-foreground/10"
                >
                  <button
                    type="button"
                    onClick={() => toggleClass(classRow.classId)}
                    aria-expanded={isExpanded}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-foreground/5"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{classRow.className}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        <span
                          className={
                            sectionCount === 0
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-foreground/60"
                          }
                        >
                          {sectionCountLabel(sectionCount)}
                        </span>
                        <span className="text-foreground/60">
                          {capacitySummary(classRow.capacity)}
                        </span>
                      </div>
                    </div>
                    <span aria-hidden="true" className="text-sm text-foreground/50">
                      {isExpanded ? "−" : "+"}
                    </span>
                  </button>

                  {isExpanded ? (
                    <div className="space-y-4 border-t border-foreground/10 px-4 py-4">
                      {fieldErrors[`class-${classRow.classId}-form`] ? (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {fieldErrors[`class-${classRow.classId}-form`]}
                        </p>
                      ) : null}

                      <div className="max-w-xs space-y-2">
                        <label
                          htmlFor={`capacity-${classRow.classId}`}
                          className="block text-sm font-medium"
                        >
                          Class capacity (optional)
                        </label>
                        <input
                          id={`capacity-${classRow.classId}`}
                          type="number"
                          min={1}
                          value={classRow.capacity}
                          onChange={(event) =>
                            updateClassSections(classRow.classId, (current) => ({
                              ...current,
                              capacity: event.target.value,
                            }))
                          }
                          className={formControlClassName}
                          aria-invalid={Boolean(
                            fieldErrors[`class-${classRow.classId}-capacity`],
                          )}
                        />
                        {fieldErrors[`class-${classRow.classId}-capacity`] ? (
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {fieldErrors[`class-${classRow.classId}-capacity`]}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <FormField
                            id={`new-section-${classRow.classId}`}
                            label="Add a section"
                            value={classRow.newSectionName}
                            onChange={(value) =>
                              updateClassSections(classRow.classId, (current) => ({
                                ...current,
                                newSectionName: value,
                              }))
                            }
                            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addSection(classRow.classId, classRow.newSectionName);
                              }
                            }}
                            error={fieldErrors[`class-${classRow.classId}-newSectionName`]}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            addSection(classRow.classId, classRow.newSectionName)
                          }
                          className="inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
                        >
                          Add
                        </button>
                      </div>

                      {classRow.sections.length === 0 ? (
                        <p className="text-sm text-foreground/60">
                          No sections added yet.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {classRow.sections.map((section, index) => (
                            <ChipListRow
                              key={`${classRow.classId}-${index}-${section.name}`}
                              label={section.name}
                              editableLabel
                              onLabelChange={(value) =>
                                renameSection(classRow.classId, index, value)
                              }
                              error={
                                fieldErrors[
                                  `class-${classRow.classId}-section-${index}-name`
                                ]
                              }
                              disableMoveUp={index === 0}
                              disableMoveDown={index === classRow.sections.length - 1}
                              onMoveUp={() => moveSection(classRow.classId, index, -1)}
                              onMoveDown={() => moveSection(classRow.classId, index, 1)}
                              onRemove={() => removeSection(classRow.classId, index)}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>

          {formError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
          ) : null}

          {successMessage ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {successMessage}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/onboarding/classes"
              className="inline-flex items-center justify-center rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-foreground/5"
            >
              Back
            </Link>
            <SubmitButton loading={loadingAction === "save"}>
              Save sections
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
