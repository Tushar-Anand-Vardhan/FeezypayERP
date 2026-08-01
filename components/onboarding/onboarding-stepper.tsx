"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";

export function OnboardingStepper() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Onboarding steps"
      className="border-b border-foreground/10 bg-background"
    >
      <ol className="mx-auto flex max-w-3xl gap-2 px-4 py-4 sm:px-6">
        {ONBOARDING_STEPS.map((step, index) => {
          const isActive = pathname === step.href;

          return (
            <li key={step.slug} className="flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden="true" className="text-foreground/30">
                  /
                </span>
              ) : null}
              <Link
                href={step.href}
                aria-current={isActive ? "step" : undefined}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-foreground text-background"
                    : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
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
