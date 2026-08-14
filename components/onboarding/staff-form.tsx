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
  getStaffStepDataAction,
  saveStaffAction,
} from "@/lib/onboarding/staff-actions";
import {
  STAFF_CSV_HEADERS,
  staffRowFromCsv,
  validateStaffDraft,
  validateStaffRows,
  type StaffFieldErrors,
  type StaffFormRow,
} from "@/lib/onboarding/staff";

const EMPTY_TEACHER: StaffFormRow = {
  fullName: "",
  phone: "",
  email: "",
  aadhaar: "",
  employeeCode: "",
  designation: "",
  departmentName: "",
  subjectNames: [],
  isHod: false,
};

const TEACHER_PAGE_SIZE = 10;

export function StaffForm() {
  const router = useRouter();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [departments, setDepartments] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [teachers, setTeachers] = useState<StaffFormRow[]>([]);
  const [draft, setDraft] = useState<StaffFormRow>(EMPTY_TEACHER);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<StaffFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"save" | "next" | null>(
    null,
  );
  const [page, setPage] = useState(1);
  useOnboardingStepReady(!initialLoading);

  const subjectNames = useMemo(
    () => subjects.map((subject) => subject.name),
    [subjects],
  );

  const pageCount = Math.max(1, Math.ceil(teachers.length / TEACHER_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedTeachers = useMemo(() => {
    const start = (currentPage - 1) * TEACHER_PAGE_SIZE;
    return teachers
      .map((teacher, index) => ({ teacher, index }))
      .slice(start, start + TEACHER_PAGE_SIZE);
  }, [teachers, currentPage]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setInitialLoading(true);
      const result = await getStaffStepDataAction();
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

      setSubjects(result.subjects);
      setDepartments(result.departments);
      setTeachers(
        result.teachers.map(
          ({
            fullName,
            phone,
            email,
            aadhaar,
            employeeCode,
            designation,
            departmentName,
            subjectNames: names,
            isHod,
          }) => ({
            fullName,
            phone,
            email,
            aadhaar,
            employeeCode,
            designation,
            departmentName,
            subjectNames: names,
            isHod,
          }),
        ),
      );
      setInitialLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function addTeacher() {
    const errors = validateStaffDraft(draft, subjectNames, teachers);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setTeachers((current) => [...current, { ...draft }]);
    setDraft(EMPTY_TEACHER);
    setFieldErrors({});
    setPage(Math.ceil((teachers.length + 1) / TEACHER_PAGE_SIZE));
  }

  function removeTeacher(index: number) {
    setTeachers((current) => current.filter((_, rowIndex) => rowIndex !== index));
    const nextLength = teachers.length - 1;
    const nextPageCount = Math.max(1, Math.ceil(nextLength / TEACHER_PAGE_SIZE));
    setPage((current) => Math.min(current, nextPageCount));
  }

  function toggleDraftSubject(name: string, checked: boolean) {
    setDraft((current) => ({
      ...current,
      subjectNames: checked
        ? [...new Set([...current.subjectNames, name])]
        : current.subjectNames.filter((value) => value !== name),
    }));
  }

  async function handleCsvUpload(file: File | null) {
    setCsvErrors([]);
    if (!file) return;

    const text = await file.text();
    const parsed = parseCsv(text);
    const missing = STAFF_CSV_HEADERS.filter(
      (header) => !parsed.headers.includes(header),
    );
    if (missing.length > 0) {
      setCsvErrors([`Missing CSV columns: ${missing.join(", ")}`]);
      return;
    }

    const rows = parsed.rows.map(staffRowFromCsv);
    const merged = [...teachers, ...rows];
    const errors = validateStaffRows(merged, subjectNames, {
      requireAtLeastOne: true,
    });

    if (Object.keys(errors).length > 0) {
      const messages = Object.entries(errors).map(
        ([key, message]) => `Row validation (${key}): ${message}`,
      );
      setCsvErrors(messages);
      return;
    }

    setTeachers(merged);
    setCsvErrors([]);
    setSuccessMessage(`Imported ${rows.length} teacher(s) from CSV.`);
    setPage(1);
  }

  async function performSave(intent: "save" | "next") {
    setFormError(null);
    setSuccessMessage(null);

    const errors = validateStaffRows(teachers, subjectNames, {
      requireAtLeastOne: intent === "next",
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});

    const formData = new FormData();
    formData.set("teachers", JSON.stringify(teachers));
    formData.set("intent", intent);

    const result = await saveStaffAction(formData);
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
      router.push("/onboarding/students");
      return;
    }
    setLoadingAction(null);
  }

  if (initialLoading) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-muted">Loading staff…</p>
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
          <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
          <p className="text-sm text-muted">Complete Subjects first.</p>
          <Link
            href="/onboarding/subjects"
            className="inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Go to Subjects
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Staff / teachers
          </h1>
          <p className="text-sm text-muted">
            Add teachers manually or via CSV. Password setup emails are only sent
            for emails that already have accounts.
          </p>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit} noValidate>
          <section className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
            <h2 className="text-base font-medium">Add teacher</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="staff-name"
                label="Full name"
                value={draft.fullName}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, fullName: value }))
                }
                error={fieldErrors.draftName}
                required
              />
              <FormField
                id="staff-email"
                label="Email"
                value={draft.email}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, email: value }))
                }
              />
              <FormField
                id="staff-aadhaar"
                label="Aadhaar (optional)"
                value={draft.aadhaar}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, aadhaar: value }))
                }
                error={fieldErrors["draft-aadhaar"]}
              />
              <FormField
                id="staff-phone"
                label="Phone"
                value={draft.phone}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, phone: value }))
                }
              />
              <FormField
                id="staff-code"
                label="Employee code"
                value={draft.employeeCode}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, employeeCode: value }))
                }
              />
              <FormField
                id="staff-designation"
                label="Designation"
                value={draft.designation}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, designation: value }))
                }
              />
              <FormField
                id="staff-department"
                label={draft.isHod ? "Department (required for HOD)" : "Department"}
                value={draft.departmentName}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, departmentName: value }))
                }
                error={
                  fieldErrors.draftDepartmentName ||
                  fieldErrors["draft-departmentName"]
                }
                required={draft.isHod}
              />
            </div>
            {departments.length > 0 ? (
              <p className="text-xs text-muted">
                Existing departments:{" "}
                {departments.map((row) => row.name).join(", ")}
              </p>
            ) : null}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Subjects taught</legend>
              <p className="text-xs text-muted">
                Select all that apply. A teacher can teach more than one subject.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {subjects.map((subject) => (
                  <li key={subject.id}>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.subjectNames.includes(subject.name)}
                        onChange={(event) =>
                          toggleDraftSubject(subject.name, event.target.checked)
                        }
                      />
                      {subject.name}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.isHod}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    isHod: event.target.checked,
                  }))
                }
              />
              Head of department
            </label>
            {draft.isHod ? (
              <p className="text-xs text-muted">
                HOD requires a department name above (which department they lead).
              </p>
            ) : null}

            <button
              type="button"
              onClick={addTeacher}
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
                    "staff-template.csv",
                    [...STAFF_CSV_HEADERS],
                    [
                      [
                        "Priya Sharma",
                        "9999999999",
                        "priya@school.edu",
                        "123412341234",
                        "T001",
                        "Teacher",
                        "Science",
                        "Physics|Chemistry",
                        "false",
                      ],
                      [
                        "Amit Verma",
                        "9888888888",
                        "amit@school.edu",
                        "432143214321",
                        "T002",
                        "HOD",
                        "Science",
                        "Physics|Chemistry|Biology",
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
            <p className="text-xs text-muted">
              Import is blocked if any row is invalid. For multiple subjects, join
              catalog names with a pipe:{" "}
              <span className="font-medium text-foreground">
                Physics|Chemistry|Math
              </span>
              . HOD rows (`is_hod=true`) must include a department.
            </p>
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
              Teacher list ({teachers.length})
            </h2>
            {fieldErrors.form ? (
              <p className="text-sm text-feezy-coral">{fieldErrors.form}</p>
            ) : null}
            {teachers.length === 0 ? (
              <p className="text-sm text-muted">No teachers added yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-strong text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Designation</th>
                      <th className="px-3 py-2 font-medium">Department</th>
                      <th className="px-3 py-2 font-medium">Subjects</th>
                      <th className="px-3 py-2 font-medium">HOD</th>
                      <th className="px-3 py-2 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedTeachers.map(({ teacher, index }) => (
                      <tr
                        key={`${teacher.email || teacher.fullName}-${index}`}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-3 py-2.5 font-medium">
                          {teacher.fullName}
                          {fieldErrors[`staff-${index}-fullName`] ? (
                            <p className="mt-1 text-xs font-normal text-feezy-coral">
                              {fieldErrors[`staff-${index}-fullName`]}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-muted">
                          {teacher.email || "—"}
                          {fieldErrors[`staff-${index}-email`] ? (
                            <p className="mt-1 text-xs text-feezy-coral">
                              {fieldErrors[`staff-${index}-email`]}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-muted">
                          {teacher.designation || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-muted">
                          {teacher.departmentName || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-muted">
                          {teacher.subjectNames.length > 0
                            ? teacher.subjectNames.join(", ")
                            : "—"}
                          {fieldErrors[`staff-${index}-subjects`] ? (
                            <p className="mt-1 text-xs text-feezy-coral">
                              {fieldErrors[`staff-${index}-subjects`]}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-muted">
                          {teacher.isHod ? "Yes" : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            className="rounded-lg border border-border px-3 py-1.5 text-sm"
                            onClick={() => removeTeacher(index)}
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
                    total={teachers.length}
                    pageSize={TEACHER_PAGE_SIZE}
                    onPageChange={setPage}
                    noun="teachers"
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
            backHref="/onboarding/houses-clubs"
            loadingAction={loadingAction}
            onSaveAndExit={handleSaveAndExit}
            onContinue={handleContinue}
          />
        </form>
      </div>
    </main>
  );
}
