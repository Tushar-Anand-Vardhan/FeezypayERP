export const ONBOARDING_STEPS = [
  {
    slug: "school-identity",
    label: "School identity",
    href: "/onboarding/school-identity",
  },
  {
    slug: "terms",
    label: "Term structure",
    href: "/onboarding/terms",
  },
  {
    slug: "classes",
    label: "Classes",
    href: "/onboarding/classes",
  },
  {
    slug: "sections",
    label: "Sections",
    href: "/onboarding/sections",
  },
  {
    slug: "subjects",
    label: "Subjects",
    href: "/onboarding/subjects",
  },
] as const;

export type OnboardingStepSlug = (typeof ONBOARDING_STEPS)[number]["slug"];

export function isOnboardingStepSlug(value: string): value is OnboardingStepSlug {
  return ONBOARDING_STEPS.some((step) => step.slug === value);
}

export const DEFAULT_ONBOARDING_PATH = ONBOARDING_STEPS[0].href;
