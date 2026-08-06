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
  {
    slug: "houses-clubs",
    label: "Houses & clubs",
    href: "/onboarding/houses-clubs",
  },
  {
    slug: "staff",
    label: "Staff",
    href: "/onboarding/staff",
  },
  {
    slug: "students",
    label: "Students",
    href: "/onboarding/students",
  },
  {
    slug: "timetable",
    label: "Timetable",
    href: "/onboarding/timetable",
  },
  {
    slug: "exams",
    label: "Exams",
    href: "/onboarding/exams",
  },
  {
    slug: "review",
    label: "Review",
    href: "/onboarding/review",
  },
] as const;

export type OnboardingStepSlug = (typeof ONBOARDING_STEPS)[number]["slug"];

export function isOnboardingStepSlug(value: string): value is OnboardingStepSlug {
  return ONBOARDING_STEPS.some((step) => step.slug === value);
}

export function getOnboardingStepHref(slug: OnboardingStepSlug) {
  return ONBOARDING_STEPS.find((step) => step.slug === slug)!.href;
}

export function getNextOnboardingStep(
  slug: OnboardingStepSlug,
): OnboardingStepSlug | null {
  const index = ONBOARDING_STEPS.findIndex((step) => step.slug === slug);
  if (index < 0 || index >= ONBOARDING_STEPS.length - 1) {
    return null;
  }
  return ONBOARDING_STEPS[index + 1].slug;
}

export function getPreviousOnboardingStep(
  slug: OnboardingStepSlug,
): OnboardingStepSlug | null {
  const index = ONBOARDING_STEPS.findIndex((step) => step.slug === slug);
  if (index <= 0) {
    return null;
  }
  return ONBOARDING_STEPS[index - 1].slug;
}

export const DEFAULT_ONBOARDING_PATH = ONBOARDING_STEPS[0].href;
