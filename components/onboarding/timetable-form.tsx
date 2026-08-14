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
  createPeriodRow,
  defaultDayStructure,
  normalizePeriodRows,
  periodDisplayLabel,
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
  const [periods, setPeriods] = useState<PeriodFormRow[]>(defaultDayStructure());
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
        result.periods.length > 0
          ? normalizePeriodRows(result.periods)
          : defaultDayStructure();
      setPeriods(nextPeriods);
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

  function updatePeriod(
    index: number,
    patch: Partial<PeriodFormRow>,
  ) {
    setPeriods((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function addPeriod(educational: boolean) {
    setPeriods((current) => [...current, createPeriodRow(current, educational)]);
  }

  function removePeriod(index: number) {
    const removed = periods[index];
    if (!removed) return;
    setPeriods((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setSlots((current) =>
      current.filter((slot) => slot.periodNumber !== removed.periodNumber),
    );
  }

  function movePeriod(index: number, direction: -1 | 1) {
    setPeriods((current) => {
      const next = index + direction;
      if (next < 0 || next >= current.length) return current;
      const copy = [...current];
      const [row] = copy.splice(index, 1);
      copy.splice(next, 0, row);
      return copy;
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
        periods,
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
        periods,
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
            Build the school day with custom period names, start/end times, and
            whether each slot is educational. Then assign a teacher (optional)
            and subject per class-section. You can skip this step for now.
          </p>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit} noValidate>
          <section className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
            <div className="space-y-1">
              <h2 className="text-base font-medium">Day structure</h2>
              <p className="text-xs text-muted">
                Name every bell yourself (Class teacher, Period 1, Lunch, Assembly).
                Uncheck Educational for breaks — subject stays empty, teacher is
                optional. CSV can use the period name or 1, 2, … for educational
                periods in order.
              </p>
            </div>
            <div className="space-y-3">
              {periods.map((period, index) => (
                <div
                  key={period.periodNumber}
                  className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]"
                >
                  <FormField
                    id={`period-${index}-name`}
                    label="Period name"
                    value={period.name}
                    onChange={(value) => updatePeriod(index, { name: value })}
                    error={fieldErrors[`period-${index}`]}
                  />
                  <FormField
                    id={`period-${index}-start`}
                    label="Start"
                    type="time"
                    value={period.startTime}
                    onChange={(value) =>
                      updatePeriod(index, { startTime: value })
                    }
                  />
                  <FormField
                    id={`period-${index}-end`}
                    label="End"
                    type="time"
                    value={period.endTime}
                    onChange={(value) => updatePeriod(index, { endTime: value })}
                  />
                  <label className="flex items-end gap-2 pb-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={period.educational}
                      onChange={(event) =>
                        updatePeriod(index, {
                          educational: event.target.checked,
                        })
                      }
                    />
                    Educational
                  </label>
                  <div className="flex items-end gap-1 pb-1">
                    <button
                      type="button"
                      className="h-10 rounded-lg border border-border px-2 text-xs text-muted"
                      onClick={() => movePeriod(index, -1)}
                      disabled={index === 0}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-lg border border-border px-2 text-xs text-muted"
                      onClick={() => movePeriod(index, 1)}
                      disabled={index === periods.length - 1}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-lg border border-border px-2 text-xs text-muted"
                      onClick={() => removePeriod(index)}
                      disabled={periods.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium"
                onClick={() => addPeriod(true)}
              >
                Add educational period
              </button>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium"
                onClick={() => addPeriod(false)}
              >
                Add break
              </button>
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
                        Name periods as they appear in the day structure.
                        Educational periods can have a subject and teacher;
                        breaks may leave both blank. Invalid rows block the import.
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
                            {periodDisplayLabel(period)}
                            <div className="text-xs text-muted">
                              {period.startTime}-{period.endTime}
                              {period.educational ? "" : " · break"}
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
                                className={`border border-border p-2 align-top ${
                                  period.educational ? "" : "bg-surface-strong/40"
                                }`}
                              >
                                {period.educational ? (
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
                                ) : null}
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
                                  <option value="">
                                    {period.educational ? "Teacher" : "Teacher (optional)"}
                                  </option>
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
