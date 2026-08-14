"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { useOnboardingProgress } from "@/components/onboarding/onboarding-progress";

type WizardActionsProps = {
  backHref?: string;
  loadingAction?: "save" | "next" | null;
  onSaveAndExit: () => void;
  onContinue: () => void;
  saveLabel?: string;
  continueLabel?: string;
};

export function WizardActions({
  backHref,
  loadingAction = null,
  onSaveAndExit,
  onContinue,
  saveLabel = "Save & exit",
  continueLabel = "Continue",
}: WizardActionsProps) {
  const busy = loadingAction !== null;
  const { start, stop } = useOnboardingProgress();
  const wasBusy = useRef(false);

  useEffect(() => {
    if (loadingAction) {
      start();
      wasBusy.current = true;
      return;
    }
    if (wasBusy.current) {
      stop();
      wasBusy.current = false;
    }
  }, [loadingAction, start, stop]);

  return (
    <div className="flex flex-col gap-2">
      {busy ? (
        <p className="text-xs text-muted" aria-live="polite">
          {loadingAction === "save"
            ? "Saving…"
            : "Saving and loading the next step…"}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground transition hover:bg-surface-strong"
              onClick={() => start()}
            >
              Back
            </Link>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <SubmitButton
            type="button"
            fullWidth={false}
            variant="ghost"
            loading={loadingAction === "save"}
            disabled={busy && loadingAction !== "save"}
            onClick={onSaveAndExit}
          >
            {saveLabel}
          </SubmitButton>
          <SubmitButton
            type="button"
            fullWidth={false}
            loading={loadingAction === "next"}
            disabled={busy && loadingAction !== "next"}
            onClick={onContinue}
          >
            {continueLabel}
          </SubmitButton>
        </div>
      </div>
    </div>
  );
}
