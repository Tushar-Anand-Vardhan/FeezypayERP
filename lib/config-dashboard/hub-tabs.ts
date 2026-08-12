import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";

export type ConfigHubTab = {
  id: string;
  label: string;
  description: string;
  /** In-hub panel or outbound link to existing admin UI */
  kind: "panel" | "link";
  href?: string;
};

/**
 * Config hub tabs: onboarding steps as editable surfaces + module links.
 * Prefer outbound links where dashboard UIs already exist (avoid delete-all writers).
 */
export const CONFIG_HUB_TABS: ConfigHubTab[] = [
  {
    id: "health",
    label: "Health",
    description: "Completion and dependency checks across modules.",
    kind: "panel",
  },
  {
    id: "school-identity",
    label: "School identity",
    description: "Name, code, logo, address, board.",
    kind: "panel",
  },
  {
    id: "terms",
    label: "Terms",
    description: "Term dates (count locked after setup).",
    kind: "panel",
  },
  {
    id: "structure",
    label: "Classes & sections",
    description: "Assignment completeness checklist.",
    kind: "panel",
  },
  {
    id: "subjects",
    label: "Subjects",
    description: "Subject master and archives.",
    kind: "link",
    href: "/dashboard/subjects",
  },
  {
    id: "houses-clubs",
    label: "Houses & clubs",
    description: "Catalogues, TIC, memberships.",
    kind: "link",
    href: "/dashboard/houses-clubs#houses",
  },
  {
    id: "staff",
    label: "Staff",
    description: "Teacher employments (principal Teachers tab).",
    kind: "link",
    href: "/dashboard/principal/teachers",
  },
  {
    id: "students",
    label: "Students",
    description: "Admissions and withdraw.",
    kind: "link",
    href: "/dashboard/principal/students",
  },
  {
    id: "enroll",
    label: "Enroll & rolls",
    description: "Section placement + roll numbers.",
    kind: "link",
    href: "/dashboard/principal/enroll",
  },
  {
    id: "timetable",
    label: "Timetable",
    description: "Periods and grids.",
    kind: "link",
    href: "/dashboard/timetable",
  },
  {
    id: "exams",
    label: "Exams",
    description: "Dated subject schedules + marking windows.",
    kind: "link",
    href: "/dashboard/assessments",
  },
  {
    id: "report-cards",
    label: "Report cards",
    description: "Template designer per class scope.",
    kind: "link",
    href: "/dashboard/report-cards",
  },
  {
    id: "grading-scales",
    label: "Grading scales",
    description: "Versioned grade bands.",
    kind: "link",
    href: "/dashboard/grading-scales",
  },
  {
    id: "departments",
    label: "Departments",
    description: "Org units and assignments.",
    kind: "link",
    href: "/dashboard/departments",
  },
];

/** Onboarding classes/sections map to the structure checklist panel. */
const STRUCTURE_ALIASES = new Set(["classes", "sections"]);

export function resolveConfigHubTab(tab: string | undefined): string {
  if (!tab) return "health";
  if (STRUCTURE_ALIASES.has(tab)) return "structure";
  if (CONFIG_HUB_TABS.some((t) => t.id === tab)) {
    return tab;
  }
  return "health";
}

/** Ensure hub tabs cover every onboarding step slug (except review). */
export function onboardingStepsCoveredByHub(): boolean {
  const hubIds = new Set(CONFIG_HUB_TABS.map((t) => t.id));
  if (hubIds.has("structure")) {
    hubIds.add("classes");
    hubIds.add("sections");
  }
  return ONBOARDING_STEPS.filter((s) => s.slug !== "review").every((s) =>
    hubIds.has(s.slug),
  );
}
