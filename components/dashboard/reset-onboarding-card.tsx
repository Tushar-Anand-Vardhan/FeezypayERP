"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import {
  RESET_ONBOARDING_CONFIRMATION,
  resetOnboardingAction,
} from "@/lib/onboarding/reset-actions";

export function ResetOnboardingCard() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setError(null);
    setLoading(true);
    const result = await resetOnboardingAction(confirmation);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(result.redirectTo);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50/60 px-6 py-6">
      <h2 className="text-lg font-semibold tracking-tight text-red-900">
        Reset onboarding
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-red-900/80">
        Deletes this school’s setup data (terms, classes, staff, students,
        timetable, exams, and related records) and restarts the onboarding
        wizard. Your admin login and school name stay. This cannot be undone.
      </p>
      <label className="mt-5 block max-w-sm text-sm font-medium text-red-950">
        Type {RESET_ONBOARDING_CONFIRMATION} to confirm
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="mt-1.5 w-full rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm text-foreground outline-none focus:border-red-400"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
      <div className="mt-5">
        <SubmitButton
          type="button"
          fullWidth={false}
          loading={loading}
          disabled={
            confirmation.trim().toUpperCase() !== RESET_ONBOARDING_CONFIRMATION
          }
          onClick={() => void handleReset()}
        >
          Reset onboarding
        </SubmitButton>
      </div>
    </section>
  );
}
