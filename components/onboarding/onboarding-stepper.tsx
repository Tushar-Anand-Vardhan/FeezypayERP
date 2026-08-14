"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";

export function OnboardingStepper() {
  const pathname = usePathname();
  const { start } = useOnboardingProgress();

  return (
    <nav
      aria-label="Onboarding steps"
      className="border-b border-border bg-surface"
    >
      <ol className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3.5 sm:flex-wrap sm:px-6">
        {ONBOARDING_STEPS.map((step, index) => {
          const isActive = pathname === step.href;

          return (
            <li key={step.slug} className="flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden="true" className="text-border">
                  /
                </span>
              ) : null}
              <Link
                href={step.href}
                aria-current={isActive ? "step" : undefined}
                onClick={() => {
                  if (!isActive) start();
                }}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-feezy-indigo text-white"
                    : "text-muted hover:bg-surface-strong hover:text-foreground"
                }`}
              >
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
