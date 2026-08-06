"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import {
  completeOnboardingAction,
  getReviewStepDataAction,
} from "@/lib/onboarding/exams-review-actions";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";

export function ReviewForm() {
  const router = useRouter();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("Your school");
  const [counts, setCounts] = useState({
    classes: 0,
    sections: 0,
    subjects: 0,
    houses: 0,
    clubs: 0,
    teachers: 0,
    students: 0,
    exams: 0,
  });
  const [timetableSkipped, setTimetableSkipped] = useState(false);
  const [timetableConfigured, setTimetableConfigured] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setInitialLoading(true);
      const result = await getReviewStepDataAction();
      if (cancelled) return;

      if (!result.success) {
        setLoadError(result.error);
        setInitialLoading(false);
        return;
      }

      setSchoolName(result.schoolName);
      setCounts(result.counts);
      setTimetableSkipped(result.timetableSkipped);
      setTimetableConfigured(result.timetableConfigured);
      setInitialLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConfirm() {
    setFormError(null);
    setLoading(true);
    const result = await completeOnboardingAction();
    if (!result.success) {
      setFormError(result.error);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    setLoading(false);
  }

  if (initialLoading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm text-muted">Loading review…</p>
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

  const summary = [
    { label: "Classes", value: counts.classes, href: "/onboarding/classes" },
    { label: "Sections", value: counts.sections, href: "/onboarding/sections" },
    { label: "Subjects", value: counts.subjects, href: "/onboarding/subjects" },
    { label: "Houses", value: counts.houses, href: "/onboarding/houses-clubs" },
    { label: "Clubs", value: counts.clubs, href: "/onboarding/houses-clubs" },
    { label: "Teachers", value: counts.teachers, href: "/onboarding/staff" },
    { label: "Students", value: counts.students, href: "/onboarding/students" },
    {
      label: "Timetable",
      value: timetableConfigured
        ? "Configured"
        : timetableSkipped
          ? "Skipped"
          : "Not set",
      href: "/onboarding/timetable",
    },
    { label: "Exams", value: counts.exams, href: "/onboarding/exams" },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Review & confirm
          </h1>
          <p className="text-sm text-muted">
            Confirm setup for <span className="font-medium">{schoolName}</span>.
            You can edit any step later from settings.
          </p>
        </div>

        <section className="grid gap-3 sm:grid-cols-2">
          {summary.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-2xl border border-border bg-surface p-4 transition hover:border-feezy-indigo/40"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {item.value}
              </p>
              <p className="mt-1 text-xs text-feezy-indigo">Edit</p>
            </Link>
          ))}
        </section>

        <section className="rounded-2xl border border-border p-4">
          <p className="text-sm font-medium">All steps</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {ONBOARDING_STEPS.filter((step) => step.slug !== "review").map(
              (step) => (
                <li key={step.slug}>
                  <Link
                    href={step.href}
                    className="inline-flex rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground"
                  >
                    {step.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </section>

        {formError ? (
          <p className="text-sm text-feezy-coral">{formError}</p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Link
            href="/onboarding/exams"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold"
          >
            Back
          </Link>
          <SubmitButton
            type="button"
            fullWidth={false}
            loading={loading}
            onClick={() => void handleConfirm()}
          >
            Confirm & go to dashboard
          </SubmitButton>
        </div>
      </div>
    </main>
  );
}
