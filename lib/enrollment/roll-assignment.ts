/** Roll-number assignment strategies (Wave 4). */

export const ROLL_STRATEGIES = [
  "sequential",
  "sort_first_asc",
  "sort_first_desc",
  "sort_last_asc",
  "sort_last_desc",
  "random",
] as const;

export type RollStrategy = (typeof ROLL_STRATEGIES)[number];

export const ROLL_STRATEGY_LABELS: Record<RollStrategy, string> = {
  sequential: "Sequential (current list order)",
  sort_first_asc: "First name A→Z",
  sort_first_desc: "First name Z→A",
  sort_last_asc: "Last name A→Z",
  sort_last_desc: "Last name Z→A",
  random: "Random",
};

export function isRollStrategy(value: string): value is RollStrategy {
  return (ROLL_STRATEGIES as readonly string[]).includes(value);
}

export type RollCandidate = {
  studentAcademicYearId: string;
  fullName: string;
};

function firstName(fullName: string): string {
  return (fullName.trim().split(/\s+/)[0] ?? "").toLowerCase();
}

function lastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

/** Fisher–Yates shuffle (mutates copy). */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Returns ordered student_academic_year ids → roll strings "1"…"n".
 */
export function assignRollNumbers(
  candidates: RollCandidate[],
  strategy: RollStrategy,
): Array<{ studentAcademicYearId: string; rollNumber: string }> {
  let ordered = [...candidates];

  switch (strategy) {
    case "sequential":
      break;
    case "sort_first_asc":
      ordered.sort((a, b) =>
        firstName(a.fullName).localeCompare(firstName(b.fullName)),
      );
      break;
    case "sort_first_desc":
      ordered.sort((a, b) =>
        firstName(b.fullName).localeCompare(firstName(a.fullName)),
      );
      break;
    case "sort_last_asc":
      ordered.sort((a, b) =>
        lastName(a.fullName).localeCompare(lastName(b.fullName)),
      );
      break;
    case "sort_last_desc":
      ordered.sort((a, b) =>
        lastName(b.fullName).localeCompare(lastName(a.fullName)),
      );
      break;
    case "random":
      ordered = shuffle(ordered);
      break;
  }

  return ordered.map((c, index) => ({
    studentAcademicYearId: c.studentAcademicYearId,
    rollNumber: String(index + 1),
  }));
}
