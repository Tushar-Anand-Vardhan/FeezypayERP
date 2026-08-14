"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FormField } from "@/components/form/form-field";
import { WizardActions } from "@/components/onboarding/wizard-actions";
import { useOnboardingStepReady } from "@/components/onboarding/onboarding-progress";
import { downloadCsvTemplate } from "@/lib/onboarding/csv";
import {
  getTimetableStepDataAction,
  saveTimetableAction,
} from "@/lib/onboarding/timetable-actions";
import {
  WEEKDAYS,
  defaultPeriods,
  validateTimetableForm,
  type PeriodFormRow,
  type TimetableFieldErrors,
  type TimetableSlotFormRow,
} from "@/lib/onboarding/timetable";
import {
  TIMETABLE_CSV_HEADERS,
  applyTimetableCsv,
  buildTimetableCsvTemplateRows,
} from "@/lib/onboarding/timetable-csv";

type SectionRow = {
  id: string;
  name: string;
  className: string;
  classTeacherId: string;
};

export function TimetableForm() {
  const router = useRouter();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<
    "prerequisites" | "sections" | "staff" | null
  >(null);
  const [periodCount, setPeriodCount] = useState(6);
  const [periods, setPeriods] = useState<PeriodFormRow[]>(defaultPeriods(6));
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [teachers, setTeachers] = useState<
    Array<{ id: string; name: string; employeeCode: string }>
  >([]);
  const [slots, setSlots] = useState<TimetableSlotFormRow[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<TimetableFieldErrors>({});
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
      const result = await getTimetableStepDataAction();
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

      const nextPeriods =
        result.periods.length > 0 ? result.periods : defaultPeriods(6);
      setPeriods(nextPeriods);
      setPeriodCount(nextPeriods.length);
      setSections(result.sections);
      setSubjects(result.subjects);
      setTeachers(result.teachers);
      setSlots(result.slots);
      setActiveSectionId(result.sections[0]?.id ?? "");
      setInitialLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const slotMap = useMemo(() => {
    const map = new Map<string, TimetableSlotFormRow>();
    for (const slot of slots) {
      map.set(`${slot.sectionId}-${slot.dayOfWeek}-${slot.periodNumber}`, slot);
    }
    return map;
  }, [slots]);

  const filledSectionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const slot of slots) {
      if (slot.subjectId || slot.teacherId) ids.add(slot.sectionId);
    }
    return ids;
  }, [slots]);

  const activeSection = sections.find((section) => section.id === activeSectionId);

  function updatePeriodCount(count: number) {
    const safe = Math.max(1, Math.min(12, count));
    setPeriodCount(safe);
    setPeriods((current) => {
      if (current.length === safe) return current;
      if (current.length > safe) return current.slice(0, safe);
      return [
        ...current,
        ...defaultPeriods(safe).slice(current.length).map((period, index) => ({
          ...period,
          periodNumber: current.length + index + 1,
        })),
      ];
    });
  }

  function getSlot(sectionId: string, day: number, periodNumber: number) {
    return (
      slotMap.get(`${sectionId}-${day}-${periodNumber}`) ?? {
        sectionId,
        dayOfWeek: day,
        periodNumber,
        subjectId: "",
        teacherId: "",
      }
    );
  }

  function upsertSlot(
    sectionId: string,
    day: number,
    periodNumber: number,
    patch: Partial<Pick<TimetableSlotFormRow, "subjectId" | "teacherId">>,
  ) {
    setSlots((current) => {
      const keyMatch = (slot: TimetableSlotFormRow) =>
        slot.sectionId === sectionId &&
        slot.dayOfWeek === day &&
        slot.periodNumber === periodNumber;
      const existing = current.find(keyMatch);
      if (!existing) {
        return [
          ...current,
          {
            sectionId,
            dayOfWeek: day,
            periodNumber,
            subjectId: patch.subjectId ?? "",
            teacherId: patch.teacherId ?? "",
          },
        ];
      }
      return current.map((slot) =>
        keyMatch(slot) ? { ...slot, ...patch } : slot,
      );
    });
  }

  async function handleCsvUpload(file: File | null) {
    setCsvErrors([]);
    setFormError(null);
    setSuccessMessage(null);
    if (!file || !activeSection) return;

    const result = applyTimetableCsv({
      csvText: await file.text(),
      catalog: {
        section: activeSection,
        periodNumbers: periods.map((period) => period.periodNumber),
        subjects,
        teachers,
      },
    });

    if (!result.ok) {
      setCsvErrors(result.errors);
      return;
    }

    setSlots((current) => [
      ...current.filter((slot) => slot.sectionId !== activeSection.id),
      ...result.slots,
    ]);
    setSuccessMessage(
      `Previewed ${result.filledCount} slot(s) for ${activeSection.className}-${activeSection.name}. Review the grid, then Save.`,
    );
  }

  function downloadSectionTemplate() {
    if (!activeSection) return;
    const safeName = `${activeSection.className}-${activeSection.name}`.replace(
      /[^\w.-]+/g,
      "_",
    );
    downloadCsvTemplate(
      `timetable-${safeName}-template.csv`,
      [...TIMETABLE_CSV_HEADERS],
      buildTimetableCsvTemplateRows({
        className: activeSection.className,
        sectionName: activeSection.name,
        periodCount: periods.length,
        sampleSubject: subjects[0]?.name,
        sampleTeacher: teachers[0]?.employeeCode || teachers[0]?.name,
      }),
    );
  }

  async function performSave(options: { skip?: boolean; soft?: boolean } = {}) {
    setFormError(null);
    setSuccessMessage(null);

    if (!options.skip && !options.soft) {
      const errors = validateTimetableForm({
        periods,
        requireConfigured: true,
      });
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return false;
      }
    } else if (!options.skip && options.soft && periods.length > 0) {
      const errors = validateTimetableForm({
        periods,
        requireConfigured: false,
      });
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return false;
      }
    }

    if (options.soft && periods.length === 0) {
      return true;
    }

    setFieldErrors({});

    const formData = new FormData();
    formData.set("skip", String(Boolean(options.skip)));
    formData.set("periods", JSON.stringify(periods));
    formData.set("slots", JSON.stringify(slots));
    formData.set(
      "classTeachers",
      JSON.stringify(
        sections.map((section) => ({
          sectionId: section.id,
          teacherId: section.classTeacherId,
        })),
      ),
    );

    const result = await saveTimetableAction(formData);
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
    const saved = await performSave({ soft: true });
    if (saved) {
      router.push("/dashboard");
      return;
    }
    setLoadingAction(null);
  }

  async function handleContinue() {
    setLoadingAction("next");
    const saved = await performSave();
    if (saved) {
      router.push("/onboarding/exams");
      return;
    }
    setLoadingAction(null);
  }

  async function handleSkip() {
    setLoadingAction("next");
    const saved = await performSave({ skip: true });
    if (saved) {
      router.push("/onboarding/exams");
      return;
    }
    setLoadingAction(null);
  }

  if (initialLoading) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-muted">Loading timetable…</p>
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
      blockedReason === "sections"
        ? {
            message: "Add at least one section before configuring the timetable.",
            href: "/onboarding/sections",
            label: "Go to Sections",
          }
        : blockedReason === "staff"
          ? {
              message: "Add at least one staff member before configuring the timetable.",
              href: "/onboarding/staff",
              label: "Go to Staff",
            }
          : {
              message:
                "Finish classes and earlier setup before configuring the timetable.",
              href: "/onboarding/classes",
              label: "Go to Classes",
            };

    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Timetable</h1>
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
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Timetable
          </h1>
          <p className="text-sm text-muted">
            Define periods once. Then upload a CSV for each class-section (or
            fill the grid). Preview first, then save. You can skip this step
            for now.
          </p>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit} noValidate>
          <section className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-40">
                <FormField
                  id="period-count"
                  label="Periods / day"
                  type="number"
                  value={String(periodCount)}
                  onChange={(value) => updatePeriodCount(Number(value) || 1)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {periods.map((period, index) => (
                <div
                  key={period.periodNumber}
                  className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3"
                >
                  <p className="col-span-2 text-sm font-medium">
                    Period {period.periodNumber}
                  </p>
                  <FormField
                    id={`period-${index}-start`}
                    label="Start"
                    type="time"
                    value={period.startTime}
                    onChange={(value) =>
                      setPeriods((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, startTime: value }
                            : row,
                        ),
                      )
                    }
                    error={fieldErrors[`period-${index}`]}
                  />
                  <FormField
                    id={`period-${index}-end`}
                    label="End"
                    type="time"
                    value={period.endTime}
                    onChange={(value) =>
                      setPeriods((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, endTime: value } : row,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setActiveSectionId(section.id);
                    setCsvErrors([]);
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    activeSectionId === section.id
                      ? "bg-feezy-indigo text-white"
                      : "border border-border text-muted"
                  }`}
                >
                  {section.className}-{section.name}
                  {filledSectionIds.has(section.id) ? " · set" : ""}
                </button>
              ))}
            </div>

            {activeSection ? (
              <div className="space-y-4 rounded-2xl border border-border p-4">
                <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-medium">
                        CSV for {activeSection.className}-{activeSection.name}
                      </h2>
                      <p className="mt-1 text-xs text-muted">
                        One file per class-section. Invalid rows block the
                        import. Subject names and teacher names/codes must match
                        what you already added.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-sm font-medium text-feezy-indigo underline-offset-4 hover:underline"
                      onClick={downloadSectionTemplate}
                    >
                      Download sample CSV
                    </button>
                  </div>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => {
                      void handleCsvUpload(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />
                  {csvErrors.length > 0 ? (
                    <ul className="space-y-1 rounded-xl border border-feezy-coral/30 bg-feezy-coral/5 p-3 text-sm text-feezy-coral">
                      {csvErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="max-w-sm space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="class-teacher">
                    Class teacher
                  </label>
                  <select
                    id="class-teacher"
                    className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
                    value={activeSection.classTeacherId}
                    onChange={(event) =>
                      setSections((current) =>
                        current.map((section) =>
                          section.id === activeSection.id
                            ? {
                                ...section,
                                classTeacherId: event.target.value,
                              }
                            : section,
                        ),
                      )
                    }
                  >
                    <option value="">Select teacher</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.employeeCode
                          ? `${teacher.name} (${teacher.employeeCode})`
                          : teacher.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border border-border px-2 py-2 text-left">
                          Period
                        </th>
                        {WEEKDAYS.map((day) => (
                          <th
                            key={day.value}
                            className="border border-border px-2 py-2 text-left"
                          >
                            {day.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((period) => (
                        <tr key={period.periodNumber}>
                          <td className="border border-border px-2 py-2 font-medium">
                            {period.periodNumber}
                            <div className="text-xs text-muted">
                              {period.startTime}-{period.endTime}
                            </div>
                          </td>
                          {WEEKDAYS.map((day) => {
                            const slot = getSlot(
                              activeSection.id,
                              day.value,
                              period.periodNumber,
                            );
                            return (
                              <td
                                key={`${day.value}-${period.periodNumber}`}
                                className="border border-border p-2 align-top"
                              >
                                <select
                                  className="mb-1 w-full rounded-lg border border-border bg-surface px-1 py-1 text-xs"
                                  value={slot.subjectId}
                                  onChange={(event) =>
                                    upsertSlot(
                                      activeSection.id,
                                      day.value,
                                      period.periodNumber,
                                      { subjectId: event.target.value },
                                    )
                                  }
                                >
                                  <option value="">Subject</option>
                                  {subjects.map((subject) => (
                                    <option key={subject.id} value={subject.id}>
                                      {subject.name}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  className="w-full rounded-lg border border-border bg-surface px-1 py-1 text-xs"
                                  value={slot.teacherId}
                                  onChange={(event) =>
                                    upsertSlot(
                                      activeSection.id,
                                      day.value,
                                      period.periodNumber,
                                      { teacherId: event.target.value },
                                    )
                                  }
                                >
                                  <option value="">Teacher</option>
                                  {teachers.map((teacher) => (
                                    <option key={teacher.id} value={teacher.id}>
                                      {teacher.employeeCode
                                        ? `${teacher.name} (${teacher.employeeCode})`
                                        : teacher.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
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

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void handleSkip()}
              disabled={loadingAction !== null}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-dashed border-border px-4 text-sm font-semibold text-muted transition hover:bg-surface-strong"
            >
              Skip for now
            </button>
            <WizardActions
              backHref="/onboarding/students"
              loadingAction={loadingAction}
              onSaveAndExit={handleSaveAndExit}
              onContinue={handleContinue}
            />
          </div>
        </form>
      </div>
    </main>
  );
}
