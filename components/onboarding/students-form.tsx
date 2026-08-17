"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FormField } from "@/components/form/form-field";
import { OnboardingPager } from "@/components/onboarding/onboarding-pager";
import { WizardActions } from "@/components/onboarding/wizard-actions";
import { useOnboardingStepReady } from "@/components/onboarding/onboarding-progress";
import { downloadCsvTemplate, parseCsv } from "@/lib/onboarding/csv";
import {
  getStudentsStepDataAction,
  saveStudentsAction,
} from "@/lib/onboarding/students-actions";
import {
  STUDENT_CSV_HEADERS,
  emptyStudent,
  studentRowFromCsv,
  validateStudentRows,
  type StudentFieldErrors,
  type StudentFormRow,
} from "@/lib/onboarding/students";

const STUDENT_PAGE_SIZE = 10;

export function StudentsForm() {
  const router = useRouter();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [classSections, setClassSections] = useState<
    Array<{
      classId: string;
      className: string;
      sectionId: string;
      sectionName: string;
    }>
  >([]);
  const [students, setStudents] = useState<StudentFormRow[]>([]);
  const [draft, setDraft] = useState<StudentFormRow>(emptyStudent());
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<StudentFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"save" | "next" | null>(
    null,
  );
  const [page, setPage] = useState(1);
  useOnboardingStepReady(!initialLoading);

  const classNames = useMemo(
    () => Array.from(new Set(classSections.map((row) => row.className))),
    [classSections],
  );

  const sectionsForDraftClass = useMemo(
    () =>
      classSections.filter((row) => row.className === draft.className).map(
        (row) => row.sectionName,
      ),
    [classSections, draft.className],
  );

  const pairOptions = useMemo(
    () =>
      classSections.map((row) => ({
        className: row.className,
        sectionName: row.sectionName,
      })),
    [classSections],
  );

  const pageCount = Math.max(1, Math.ceil(students.length / STUDENT_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedStudents = useMemo(() => {
    const start = (currentPage - 1) * STUDENT_PAGE_SIZE;
    return students
      .map((student, index) => ({ student, index }))
      .slice(start, start + STUDENT_PAGE_SIZE);
  }, [students, currentPage]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setInitialLoading(true);
      const result = await getStudentsStepDataAction();
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

      setClassSections(result.classSections);
      setStudents(
        result.students.map((student) => ({
          ...student,
          guardians:
            student.guardians.length > 0
              ? student.guardians
              : emptyStudent().guardians,
        })),
      );
      setInitialLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function addStudent() {
    const errors = validateStudentRows([draft], pairOptions);
    if (Object.keys(errors).length > 0) {
      const remapped: StudentFieldErrors = {};
      for (const [key, value] of Object.entries(errors)) {
        remapped[key.replace("student-0-", "draft-")] = value;
      }
      setFieldErrors(remapped);
      return;
    }

    setStudents((current) => [...current, draft]);
    setDraft(emptyStudent());
    setFieldErrors({});
    setPage(Math.ceil((students.length + 1) / STUDENT_PAGE_SIZE));
  }

  function removeStudent(index: number) {
    setStudents((current) => current.filter((_, rowIndex) => rowIndex !== index));
    const nextLength = students.length - 1;
    const nextPageCount = Math.max(1, Math.ceil(nextLength / STUDENT_PAGE_SIZE));
    setPage((current) => Math.min(current, nextPageCount));
  }

  async function handleCsvUpload(file: File | null) {
    setCsvErrors([]);
    if (!file) return;

    const text = await file.text();
    const parsed = parseCsv(text);
    const missing = STUDENT_CSV_HEADERS.filter(
      (header) => !parsed.headers.includes(header),
    );
    if (missing.length > 0) {
      setCsvErrors([`Missing CSV columns: ${missing.join(", ")}`]);
      return;
    }

    const rows = parsed.rows.map(studentRowFromCsv);
    const csvErrorsMap = validateStudentRows(rows, pairOptions, {
      requireAtLeastOne: true,
    });

    if (Object.keys(csvErrorsMap).length > 0) {
      setCsvErrors(
        Object.entries(csvErrorsMap).map(([key, message]) => {
          const match = /^student-(\d+)-/.exec(key);
          if (match) {
            const rowNumber = Number(match[1]) + 2; // header is line 1
            return `CSV row ${rowNumber}: ${message}`;
          }
          return message;
        }),
      );
      return;
    }

    const merged = [...students, ...rows];
    const mergedErrors = validateStudentRows(merged, pairOptions, {
      requireAtLeastOne: true,
    });
    if (Object.keys(mergedErrors).length > 0) {
      setCsvErrors(
        Object.entries(mergedErrors).map(
          ([, message]) => message,
        ),
      );
      return;
    }

    setStudents(merged);
    setSuccessMessage(`Imported ${rows.length} student(s) from CSV.`);
    setPage(1);
  }

  async function performSave(intent: "save" | "next") {
    setFormError(null);
    setSuccessMessage(null);

    const errors = validateStudentRows(students, pairOptions, {
      requireAtLeastOne: intent === "next",
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});

    const formData = new FormData();
    formData.set("students", JSON.stringify(students));
    formData.set("intent", intent);

    const result = await saveStudentsAction(formData);
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
      router.push("/onboarding/timetable");
      return;
    }
    setLoadingAction(null);
  }

  if (initialLoading) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-muted">Loading students…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-feezy-coral">{loadError}</p>
      </main>
    );
  }

  if (blocked) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-sm text-muted">Complete Classes and Sections first.</p>
          <Link
            href="/onboarding/sections"
            className="inline-flex text-sm font-medium underline-offset-4 hover:underline"
          >
            Go to Sections
          </Link>
        </div>
      </main>
    );
  }

  const guardian = draft.guardians[0];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Students
          </h1>
          <p className="text-sm text-muted">
            Add students with guardian details and section enrollment. CSV import
            blocks if any row is invalid.
          </p>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit} noValidate>
          <section className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
            <h2 className="text-base font-medium">Add student</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="student-name"
                label="Full name"
                value={draft.fullName}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, fullName: value }))
                }
                error={fieldErrors["draft-fullName"]}
                required
              />
              <FormField
                id="student-admission"
                label="Admission number"
                value={draft.admissionNumber}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    admissionNumber: value,
                  }))
                }
                error={fieldErrors["draft-admissionNumber"]}
                required
              />
              <FormField
                id="student-aadhaar"
                label="Aadhaar (optional)"
                value={draft.aadhaar}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, aadhaar: value }))
                }
                error={fieldErrors["draft-aadhaar"]}
              />
              <FormField
                id="student-email"
                label="Email (optional)"
                value={draft.email}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, email: value }))
                }
              />
              <FormField
                id="student-dob"
                label="Date of birth"
                type="date"
                value={draft.dateOfBirth}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, dateOfBirth: value }))
                }
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="student-gender">
                  Gender
                </label>
                <select
                  id="student-gender"
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
                  value={draft.gender}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      gender: event.target.value as StudentFormRow["gender"],
                    }))
                  }
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="student-class">
                  Class
                </label>
                <select
                  id="student-class"
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
                  value={draft.className}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      className: event.target.value,
                      sectionName: "",
                    }))
                  }
                >
                  <option value="">Select class</option>
                  {classNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="student-section">
                  Section
                </label>
                <select
                  id="student-section"
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
                  value={draft.sectionName}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sectionName: event.target.value,
                    }))
                  }
                >
                  <option value="">Select section</option>
                  {sectionsForDraftClass.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                {fieldErrors["draft-section"] ? (
                  <p className="text-sm text-feezy-coral">
                    {fieldErrors["draft-section"]}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border p-3">
              <h3 className="text-sm font-medium">Primary guardian</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="guardian-name"
                  label="Guardian name"
                  value={guardian.fullName}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      guardians: [{ ...current.guardians[0], fullName: value }],
                    }))
                  }
                  error={fieldErrors["draft-guardian"]}
                  required
                />
                <FormField
                  id="guardian-relationship"
                  label="Relationship"
                  value={guardian.relationship}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      guardians: [
                        { ...current.guardians[0], relationship: value },
                      ],
                    }))
                  }
                />
                <FormField
                  id="guardian-phone"
                  label="Phone"
                  value={guardian.phone}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      guardians: [{ ...current.guardians[0], phone: value }],
                    }))
                  }
                />
                <FormField
                  id="guardian-whatsapp"
                  label="WhatsApp"
                  value={guardian.whatsappNumber}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      guardians: [
                        { ...current.guardians[0], whatsappNumber: value },
                      ],
                    }))
                  }
                />
                <FormField
                  id="guardian-email"
                  label="Email"
                  value={guardian.email}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      guardians: [{ ...current.guardians[0], email: value }],
                    }))
                  }
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={guardian.whatsappOptIn}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      guardians: [
                        {
                          ...current.guardians[0],
                          whatsappOptIn: event.target.checked,
                        },
                      ],
                    }))
                  }
                />
                WhatsApp opt-in
              </label>
            </div>

            <button
              type="button"
              onClick={addStudent}
              className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background"
            >
              Add to list
            </button>
          </section>

          <section className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-medium">CSV import</h2>
              <button
                type="button"
                className="text-sm font-medium text-feezy-indigo underline-offset-4 hover:underline"
                onClick={() =>
                  downloadCsvTemplate(
                    "students-template.csv",
                    [...STUDENT_CSV_HEADERS],
                    [
                      [
                        "Aarav Patel",
                        "2015-04-12",
                        "male",
                        "ADM001",
                        "123456789012",
                        "",
                        classSections[0]?.className ?? "Class 1",
                        classSections[0]?.sectionName ?? "A",
                        "Ravi Patel",
                        "father",
                        "9888888888",
                        "9888888888",
                        "ravi@email.com",
                        "true",
                      ],
                    ],
                  )
                }
              >
                Download template
              </button>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) =>
                void handleCsvUpload(event.target.files?.[0] ?? null)
              }
            />
            {csvErrors.length > 0 ? (
              <ul className="space-y-1 rounded-xl border border-feezy-coral/30 bg-feezy-coral/5 p-3 text-sm text-feezy-coral">
                {csvErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium">
              Student list ({students.length})
            </h2>
            {fieldErrors.form ? (
              <p className="text-sm text-feezy-coral">{fieldErrors.form}</p>
            ) : null}
            {students.length === 0 ? (
              <p className="text-sm text-muted">No students added yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-strong text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Admission no.</th>
                      <th className="px-3 py-2 font-medium">Class</th>
                      <th className="px-3 py-2 font-medium">Section</th>
                      <th className="px-3 py-2 font-medium">DOB</th>
                      <th className="px-3 py-2 font-medium">Guardian</th>
                      <th className="px-3 py-2 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedStudents.map(({ student, index }) => (
                      <tr
                        key={`${student.admissionNumber}-${index}`}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-3 py-2.5 font-medium">
                          {student.fullName}
                          {fieldErrors[`student-${index}-fullName`] ? (
                            <p className="mt-1 text-xs font-normal text-feezy-coral">
                              {fieldErrors[`student-${index}-fullName`]}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-muted">
                          {student.admissionNumber || "—"}
                          {fieldErrors[`student-${index}-admissionNumber`] ? (
                            <p className="mt-1 text-xs text-feezy-coral">
                              {fieldErrors[`student-${index}-admissionNumber`]}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-muted">
                          {student.className || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-muted">
                          {student.sectionName || "—"}
                          {fieldErrors[`student-${index}-section`] ? (
                            <p className="mt-1 text-xs text-feezy-coral">
                              {fieldErrors[`student-${index}-section`]}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-muted">
                          {student.dateOfBirth || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-muted">
                          {student.guardians[0]?.fullName || "—"}
                          {fieldErrors[`student-${index}-guardian`] ? (
                            <p className="mt-1 text-xs text-feezy-coral">
                              {fieldErrors[`student-${index}-guardian`]}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            className="rounded-lg border border-border px-3 py-1.5 text-sm"
                            onClick={() => removeStudent(index)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-border px-3 py-3">
                  <OnboardingPager
                    page={currentPage}
                    pageCount={pageCount}
                    total={students.length}
                    pageSize={STUDENT_PAGE_SIZE}
                    onPageChange={setPage}
                    noun="students"
                  />
                </div>
              </div>
            )}
          </section>

          {formError ? (
            <p className="text-sm text-feezy-coral">{formError}</p>
          ) : null}
          {successMessage ? (
            <p className="text-sm text-emerald-600">{successMessage}</p>
          ) : null}

          <WizardActions
            backHref="/onboarding/staff"
            loadingAction={loadingAction}
            onSaveAndExit={handleSaveAndExit}
            onContinue={handleContinue}
          />
        </form>
      </div>
    </main>
  );
}
