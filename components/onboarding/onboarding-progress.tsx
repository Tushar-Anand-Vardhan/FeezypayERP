"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type OnboardingProgressContextValue = {
  active: boolean;
  start: () => void;
  stop: () => void;
};

const OnboardingProgressContext =
  createContext<OnboardingProgressContextValue | null>(null);

export function OnboardingProgressProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [active, setActive] = useState(false);
  const start = useCallback(() => setActive(true), []);
  const stop = useCallback(() => setActive(false), []);
  const value = useMemo(
    () => ({ active, start, stop }),
    [active, start, stop],
  );

  return (
    <OnboardingProgressContext.Provider value={value}>
      {children}
    </OnboardingProgressContext.Provider>
  );
}

export function useOnboardingProgress() {
  const ctx = useContext(OnboardingProgressContext);
  if (!ctx) {
    return {
      active: false,
      start: () => undefined,
      stop: () => undefined,
    };
  }
  return ctx;
}

/** Keep the bar up while a step is fetching, then clear when ready. */
export function useOnboardingStepReady(ready: boolean) {
  const { start, stop } = useOnboardingProgress();
  useEffect(() => {
    if (ready) {
      stop();
      return;
    }
    start();
  }, [ready, start, stop]);
}

export function OnboardingProgressBar() {
  const { active } = useOnboardingProgress();

  return (
    <div
      className="h-1 w-full overflow-hidden bg-border"
      role="progressbar"
      aria-hidden={!active}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-busy={active}
      aria-label="Onboarding progress"
    >
      {active ? <div className="feezy-progress-indeterminate" /> : null}
    </div>
  );
}
