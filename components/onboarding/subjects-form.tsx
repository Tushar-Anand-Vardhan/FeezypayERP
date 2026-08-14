"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FormField } from "@/components/form/form-field";
import { WizardActions } from "@/components/onboarding/wizard-actions";
import { useOnboardingStepReady } from "@/components/onboarding/onboarding-progress";
import {
  getSubjectsStepDataAction,
  saveSubjectsStepAction,
} from "@/lib/onboarding/subjects-actions";
import {
  SUBJECT_TYPES,
  validateClassSubjectAssignments,
  validateSubjects,
  type ClassSubjectAssignmentsFormRow,
  type SubjectFieldErrors,
  type SubjectFormRow,
  type SubjectType,
} from "@/lib/onboarding/subjects";

type ClassAssignmentUiState = {
  classId: string;
  className: string;
  assigned: boolean[];
  elective: boolean[];
};

type SubjectDraft = {
  name: string;
  code: string;
  type: SubjectType;
  classIds: string[];
  elective: boolean;
};

type SubjectListSummary = {
  classCount: number;
  classLabel: string;
  hasElective: boolean;
  allElective: boolean;
};

const EMPTY_DRAFT: SubjectDraft = {
  name: "",
  code: "",
  type: "scholastic",
  classIds: [],
  elective: false,
};

function buildAssignmentUiState(
  subjects: SubjectFormRow[],
  classes: Array<{ id: string; name: string }>,
  classAssignments: ClassSubjectAssignmentsFormRow[],
): ClassAssignmentUiState[] {
  const assignmentMap = new Map(
    classAssignments.map((row) => [row.classId, row.assignedSubjects]),
  );

  return classes.map((classRow) => {
    const assignedRows = assignmentMap.get(classRow.id) ?? [];
    const assigned = subjects.map((subject) =>
      assignedRows.some(
        (row) =>
          row.subjectName.trim().toLowerCase() === subject.name.trim().toLowerCase(),
      ),
    );
    const elective = subjects.map((subject) => {
      const match = assignedRows.find(
        (row) =>
          row.subjectName.trim().toLowerCase() === subject.name.trim().toLowerCase(),
      );
      return match?.isElective ?? false;
    });

    return {
      classId: classRow.id,
      className: classRow.name,
      assigned,
      elective,
    };
  });
}

function resizeAssignmentRows(
  classRow: ClassAssignmentUiState,
  subjectCount: number,
): ClassAssignmentUiState {
  const assigned = [...classRow.assigned];
  const elective = [...classRow.elective];

  while (assigned.length < subjectCount) {
    assigned.push(false);
    elective.push(false);
  }

  assigned.length = subjectCount;
  elective.length = subjectCount;

  return { ...classRow, assigned, elective };
}

function toClassAssignmentsPayload(
  assignmentState: ClassAssignmentUiState[],
  subjects: SubjectFormRow[],
): ClassSubjectAssignmentsFormRow[] {
  return assignmentState.map((classRow) => ({
    classId: classRow.classId,
    assignedSubjects: subjects
      .map((subject, index) => ({
        subjectName: subject.name,
        isElective: classRow.elective[index] ?? false,
        assigned: classRow.assigned[index] ?? false,
      }))
      .filter((row) => row.assigned)
      .map(({ subjectName, isElective }) => ({ subjectName, isElective })),
  }));
}

function buildSubjectSummaries(
  subjects: SubjectFormRow[],
  assignmentState: ClassAssignmentUiState[],
): SubjectListSummary[] {
  return subjects.map((_, subjectIndex) => {
    const assignedClassNames: string[] = [];
    let hasElective = false;
    let allElective = true;

    for (const classRow of assignmentState) {
      if (!classRow.assigned[subjectIndex]) {
        continue;
      }

      assignedClassNames.push(classRow.className);
      if (classRow.elective[subjectIndex]) {
        hasElective = true;
      } else {
        allElective = false;
      }
    }

    const classCount = assignedClassNames.length;
    let classLabel = "No classes assigned";

    if (classCount === 1) {
      classLabel = assignedClassNames[0];
    } else if (classCount === 2) {
      classLabel = assignedClassNames.join(", ");
    } else if (classCount > 2) {
      classLabel = `${assignedClassNames.slice(0, 2).join(", ")} +${classCount - 2} more`;
    } else if (classCount > 0) {
      classLabel = `${classCount} classes`;
    }

    return {
      classCount,
      classLabel,
      hasElective,
      allElective: classCount > 0 && allElective,
    };
  });
}

function draftFromSubject(
  subject: SubjectFormRow,
  subjectIndex: number,
  assignmentState: ClassAssignmentUiState[],
): SubjectDraft {
  const classIds: string[] = [];

  for (const classRow of assignmentState) {
    if (classRow.assigned[subjectIndex]) {
      classIds.push(classRow.classId);
    }
  }

  const elective =
    classIds.length > 0 &&
    assignmentState.every(
      (classRow) =>
        !classRow.assigned[subjectIndex] || classRow.elective[subjectIndex],
    );

  return {
    name: subject.name,
    code: subject.code,
    type: subject.type,
    classIds,
    elective,
  };
}

function syncSubjectAssignments(
  subjectIndex: number,
  classIds: string[],
  elective: boolean,
  assignmentState: ClassAssignmentUiState[],
): ClassAssignmentUiState[] {
  const selectedClassIds = new Set(classIds);

  return assignmentState.map((classRow) => {
    const assigned = [...classRow.assigned];
    const electiveFlags = [...classRow.elective];
    const isSelected = selectedClassIds.has(classRow.classId);

    assigned[subjectIndex] = isSelected;
    electiveFlags[subjectIndex] = isSelected ? elective : false;

    return { ...classRow, assigned, elective: electiveFlags };
  });
}

function validateSubjectDraft(
  draft: SubjectDraft,
  subjects: SubjectFormRow[],
  editingIndex: number | null,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const trimmedName = draft.name.trim();

  if (!trimmedName) {
    errors.draftName = "Subject name is required.";
  }

  if (!SUBJECT_TYPES.includes(draft.type)) {
    errors.draftType = "Select a valid subject type.";
  }

  if (trimmedName) {
    const duplicateIndex = subjects.findIndex(
      (row, index) =>
        index !== editingIndex &&
        row.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    if (duplicateIndex !== -1) {
      errors.draftName = "This subject name duplicates another.";
    }
  }

  return errors;
}

function subjectTypeLabel(type: SubjectType) {
  return type === "scholastic" ? "Scholastic" : "Co-scholastic";
}

export function SubjectsForm() {
  const router = useRouter();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [subjects, setSubjects] = useState<SubjectFormRow[]>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [assignmentState, setAssignmentState] = useState<ClassAssignmentUiState[]>([]);
  const [draft, setDraft] = useState<SubjectDraft>(EMPTY_DRAFT);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SubjectFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"save" | "next" | null>(null);
  useOnboardingStepReady(!initialLoading);

  const showAdvanced = subjects.length > 0 && classes.length > 0;

  useEffect(() => {
    let cancelled = false;

    async function loadSubjectsStep() {
      setInitialLoading(true);
      setLoadError(null);

      const result = await getSubjectsStepDataAction();

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
      setSubjects(result.subjects);
      setClasses(result.classes);
      setAssignmentState(
        buildAssignmentUiState(result.subjects, result.classes, result.classAssignments),
      );
      setInitialLoading(false);
    }

    void loadSubjectsStep();

    return () => {
      cancelled = true;
    };
  }, []);

  const subjectSummaries = useMemo(
    () => buildSubjectSummaries(subjects, assignmentState),
    [subjects, assignmentState],
  );

  const assignmentCountByClassId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const classRow of assignmentState) {
      counts.set(classRow.classId, classRow.assigned.filter(Boolean).length);
    }
    return counts;
  }, [assignmentState]);

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
    setEditingIndex(null);
    setDraftErrors({});
  }

  function openEditForm(index: number) {
    setEditingIndex(index);
    setDraft(draftFromSubject(subjects[index], index, assignmentState));
    setDraftErrors({});
  }

  function toggleDraftClass(classId: string, checked: boolean) {
    setDraft((current) => ({
      ...current,
      classIds: checked
        ? [...new Set([...current.classIds, classId])]
        : current.classIds.filter((id) => id !== classId),
    }));
  }

  function selectAllDraftClasses() {
    setDraft((current) => ({
      ...current,
      classIds: classes.map((classRow) => classRow.id),
    }));
  }

  function clearAllDraftClasses() {
    setDraft((current) => ({ ...current, classIds: [] }));
  }

  function commitDraft() {
    const errors = validateSubjectDraft(draft, subjects, editingIndex);
    if (Object.keys(errors).length > 0) {
      setDraftErrors(errors);
      return;
    }

    setDraftErrors({});
    const nextSubject: SubjectFormRow = {
      name: draft.name.trim(),
      code: draft.code.trim(),
      type: draft.type,
    };

    if (editingIndex === null) {
      const nextIndex = subjects.length;
      setSubjects((current) => [...current, nextSubject]);
      setAssignmentState((current) => {
        const resized = current.map((classRow) =>
          resizeAssignmentRows(classRow, nextIndex + 1),
        );
        return syncSubjectAssignments(nextIndex, draft.classIds, draft.elective, resized);
      });
    } else {
      setSubjects((current) =>
        current.map((row, index) => (index === editingIndex ? nextSubject : row)),
      );
      setAssignmentState((current) =>
        syncSubjectAssignments(editingIndex, draft.classIds, draft.elective, current),
      );
    }

    resetDraft();
  }

  function removeSubject(index: number) {
    setSubjects((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setAssignmentState((current) =>
      current.map((classRow) => {
        const assigned = classRow.assigned.filter((_, rowIndex) => rowIndex !== index);
        const elective = classRow.elective.filter((_, rowIndex) => rowIndex !== index);
        return { ...classRow, assigned, elective };
      }),
    );

    if (editingIndex === index) {
      resetDraft();
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  }

  function toggleClass(classId: string) {
    setExpandedClassId((current) => (current === classId ? null : classId));
  }

  function toggleAssigned(classId: string, subjectIndex: number, assigned: boolean) {
    setAssignmentState((current) =>
      current.map((classRow) =>
        classRow.classId === classId
          ? {
              ...classRow,
              assigned: classRow.assigned.map((value, index) =>
                index === subjectIndex ? assigned : value,
              ),
              elective: classRow.elective.map((value, index) =>
                index === subjectIndex ? (assigned ? value : false) : value,
              ),
            }
          : classRow,
      ),
    );
  }

  function toggleElective(classId: string, subjectIndex: number, isElective: boolean) {
    setAssignmentState((current) =>
      current.map((classRow) =>
        classRow.classId === classId
          ? {
              ...classRow,
              elective: classRow.elective.map((value, index) =>
                index === subjectIndex ? isElective : value,
              ),
            }
          : classRow,
      ),
    );
  }

  async function performSave(intent: "save" | "next") {
    setFormError(null);
    setSuccessMessage(null);

    const classAssignments = toClassAssignmentsPayload(assignmentState, subjects);
    const subjectErrors = validateSubjects(subjects, {
      requireAtLeastOne: intent === "next",
    });
    const assignmentErrors = validateClassSubjectAssignments(subjects, classAssignments);
    const validationErrors = { ...subjectErrors, ...assignmentErrors };

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return false;
    }

    setFieldErrors({});

    const formData = new FormData();
    formData.set("subjects", JSON.stringify(subjects));
    formData.set("classAssignments", JSON.stringify(classAssignments));
    formData.set("intent", intent);

    const result = await saveSubjectsStepAction(formData);

    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
      return false;
    }

    setSuccessMessage(result.message);

    const reload = await getSubjectsStepDataAction();
    if (reload.success && !reload.blocked) {
      setSubjects(reload.subjects);
      setClasses(reload.classes);
      setAssignmentState(
        buildAssignmentUiState(
          reload.subjects,
          reload.classes,
          reload.classAssignments,
        ),
      );
    }

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
      router.push("/onboarding/houses-clubs");
      return;
    }
    setLoadingAction(null);
  }

  if (initialLoading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-muted">Loading subjects…</p>
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
          <h1 className="text-2xl font-semibold tracking-tight">Subjects</h1>
          <p className="text-sm text-muted">Complete Sections first.</p>
          <Link
            href="/onboarding/sections"
            className="inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Go to Sections
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Subjects</h1>
          <p className="text-sm text-muted">
            Add each subject with the classes it applies to. Use the advanced
            panel below only when elective status differs by class.
          </p>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit} noValidate>
          <section className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
            <div className="space-y-1">
              <h2 className="text-base font-medium">
                {editingIndex === null ? "Add subject" : "Edit subject"}
              </h2>
              <p className="text-sm text-foreground/60">
                Name, type, class assignments, and elective status in one step.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="subject-draft-name"
                label="Subject name"
                value={draft.name}
                onChange={(value) => setDraft((current) => ({ ...current, name: value }))}
                error={draftErrors.draftName}
                required
              />
              <FormField
                id="subject-draft-code"
                label="Code (optional)"
                value={draft.code}
                onChange={(value) => setDraft((current) => ({ ...current, code: value }))}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Type</legend>
              <div className="flex flex-wrap gap-4">
                {(["scholastic", "co_scholastic"] as SubjectType[]).map((type) => (
                  <label key={type} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="subject-draft-type"
                      checked={draft.type === type}
                      onChange={() => setDraft((current) => ({ ...current, type }))}
                    />
                    {subjectTypeLabel(type)}
                  </label>
                ))}
              </div>
              {draftErrors.draftType ? (
                <p className="text-sm text-feezy-coral">
                  {draftErrors.draftType}
                </p>
              ) : null}
            </fieldset>

            {classes.length > 0 ? (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Classes</legend>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllDraftClasses}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-border"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearAllDraftClasses}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-border"
                  >
                    Clear all
                  </button>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {classes.map((classRow) => (
                    <li key={classRow.id}>
                      <label className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.classIds.includes(classRow.id)}
                          onChange={(event) =>
                            toggleDraftClass(classRow.id, event.target.checked)
                          }
                        />
                        {classRow.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ) : null}

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.elective}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, elective: event.target.checked }))
                }
              />
              Elective for selected classes
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={commitDraft}
                className="inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
              >
                {editingIndex === null ? "Add subject" : "Update subject"}
              </button>
              {editingIndex !== null ? (
                <button
                  type="button"
                  onClick={resetDraft}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-medium">Subject list</h2>

            {fieldErrors.form ? (
              <p className="text-sm text-feezy-coral">{fieldErrors.form}</p>
            ) : null}

            {subjects.length === 0 ? (
              <p className="text-sm text-foreground/60">No subjects added yet.</p>
            ) : (
              <ul className="space-y-2">
                {subjects.map((subject, index) => {
                  const summary = subjectSummaries[index];
                  const isEditing = editingIndex === index;

                  return (
                    <li key={`subject-row-${index}`}>
                      <div
                        className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
                          isEditing
                            ? "border-border bg-surface-strong"
                            : "border-border hover:border-border"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => openEditForm(index)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {subject.name || `Subject ${index + 1}`}
                            </span>
                            {subject.code ? (
                              <span className="text-sm text-foreground/50">
                                ({subject.code})
                              </span>
                            ) : null}
                            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">
                              {subjectTypeLabel(subject.type)}
                            </span>
                            {summary?.hasElective ? (
                              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                                {summary.allElective ? "Elective" : "Elective (some classes)"}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-foreground/60">
                            {summary?.classCount === 0
                              ? "No classes assigned"
                              : summary?.classCount === 1
                                ? summary.classLabel
                                : summary && summary.classCount > 2
                                  ? `${summary.classCount} classes · ${summary.classLabel}`
                                  : summary?.classLabel}
                          </p>
                          {fieldErrors[`subject-${index}-name`] ? (
                            <p className="mt-1 text-sm text-feezy-coral">
                              {fieldErrors[`subject-${index}-name`]}
                            </p>
                          ) : null}
                          {fieldErrors[`subject-${index}-type`] ? (
                            <p className="mt-1 text-sm text-feezy-coral">
                              {fieldErrors[`subject-${index}-type`]}
                            </p>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSubject(index)}
                          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {showAdvanced ? (
            <section className="overflow-hidden rounded-2xl border border-border">
              <button
                type="button"
                onClick={() => setAdvancedExpanded((current) => !current)}
                aria-expanded={advancedExpanded}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-surface-strong"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Advanced: edit assignments per class
                  </p>
                  <p className="text-xs text-foreground/60">
                    For elective status that differs by class, or to fix mismatches.
                  </p>
                </div>
                <span aria-hidden="true" className="text-sm text-foreground/50">
                  {advancedExpanded ? "−" : "+"}
                </span>
              </button>

              {advancedExpanded ? (
                <div className="space-y-3 border-t border-border px-4 py-4">
                  {assignmentState.map((classRow) => {
                    const isExpanded = expandedClassId === classRow.classId;
                    const assignedCount = assignmentCountByClassId.get(classRow.classId) ?? 0;

                    return (
                      <section
                        key={classRow.classId}
                        className="overflow-hidden rounded-2xl border border-border"
                      >
                        <button
                          type="button"
                          onClick={() => toggleClass(classRow.classId)}
                          aria-expanded={isExpanded}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-surface-strong"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{classRow.className}</p>
                            <p className="text-xs text-foreground/60">
                              {assignedCount === 0
                                ? "No subjects assigned yet"
                                : assignedCount === 1
                                  ? "1 subject assigned"
                                  : `${assignedCount} subjects assigned`}
                            </p>
                          </div>
                          <span aria-hidden="true" className="text-sm text-foreground/50">
                            {isExpanded ? "−" : "+"}
                          </span>
                        </button>

                        {isExpanded ? (
                          <div className="space-y-3 border-t border-border px-4 py-4">
                            {fieldErrors[`class-${classRow.classId}-assignments`] ? (
                              <p className="text-sm text-feezy-coral">
                                {fieldErrors[`class-${classRow.classId}-assignments`]}
                              </p>
                            ) : null}

                            <ul className="space-y-2">
                              {subjects.map((subject, subjectIndex) => {
                                const assigned = classRow.assigned[subjectIndex] ?? false;
                                const isElective = classRow.elective[subjectIndex] ?? false;

                                return (
                                  <li
                                    key={`${classRow.classId}-${subjectIndex}`}
                                    className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <label className="inline-flex items-center gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={assigned}
                                        onChange={(event) =>
                                          toggleAssigned(
                                            classRow.classId,
                                            subjectIndex,
                                            event.target.checked,
                                          )
                                        }
                                      />
                                      <span>
                                        {subject.name || `Subject ${subjectIndex + 1}`}
                                        {subject.code ? (
                                          <span className="text-foreground/50">
                                            {" "}
                                            ({subject.code})
                                          </span>
                                        ) : null}
                                      </span>
                                    </label>

                                    <label
                                      className={`inline-flex items-center gap-2 text-sm ${
                                        assigned
                                          ? "text-muted"
                                          : "cursor-not-allowed text-foreground/40"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isElective}
                                        disabled={!assigned}
                                        onChange={(event) =>
                                          toggleElective(
                                            classRow.classId,
                                            subjectIndex,
                                            event.target.checked,
                                          )
                                        }
                                      />
                                      Elective
                                    </label>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}

          {formError ? (
            <p className="text-sm text-feezy-coral">{formError}</p>
          ) : null}

          {successMessage ? (
            <p className="text-sm text-emerald-600">
              {successMessage}
            </p>
          ) : null}

          <WizardActions
            backHref="/onboarding/sections"
            loadingAction={loadingAction}
            onSaveAndExit={handleSaveAndExit}
            onContinue={handleContinue}
          />
        </form>
      </div>
    </main>
  );
}
