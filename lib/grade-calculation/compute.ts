import type {
  CategoryMarksInput,
  FormulaPartInput,
  GradeBand,
  GraceRulesConfig,
  PassStatus,
  StudentSubjectCalcInput,
  SubjectCalcOutput,
} from "@/lib/grade-calculation/types";

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Average obtained/max across evidence rows already aggregated into category. */
export function categoryContribution(
  category: CategoryMarksInput,
  weightPercent: number,
): { weightedMarks: number; weightedMax: number; pct: number } {
  if (category.exempt || category.maxMarks <= 0) {
    return { weightedMarks: 0, weightedMax: 0, pct: 0 };
  }
  const pct = (category.obtained / category.maxMarks) * 100;
  const weightedMarks = (pct / 100) * weightPercent;
  return {
    weightedMarks: round4(weightedMarks),
    weightedMax: round4(weightPercent),
    pct: round4(pct),
  };
}

export function mapPercentageToGrade(
  percentage: number,
  bands: GradeBand[],
): { letter: string | null; gradePoints: number | null } {
  if (!bands.length) return { letter: null, gradePoints: null };
  const sorted = [...bands].sort((a, b) => b.minPercent - a.minPercent);
  for (const b of sorted) {
    if (percentage >= b.minPercent && percentage <= b.maxPercent) {
      return {
        letter: b.letter,
        gradePoints: b.gradePoints ?? null,
      };
    }
  }
  // Edge: slightly over 100 due to rounding
  if (percentage > 100) {
    const top = sorted[0];
    return {
      letter: top?.letter ?? null,
      gradePoints: top?.gradePoints ?? null,
    };
  }
  return { letter: null, gradePoints: null };
}

export function applyGrace(
  percentage: number,
  finalMarks: number,
  maxMarks: number,
  grace: GraceRulesConfig | undefined,
  passPercent: number,
): { percentage: number; finalMarks: number; graceApplied: number } {
  if (!grace?.maxGraceMarks || grace.maxGraceMarks <= 0) {
    return { percentage, finalMarks, graceApplied: 0 };
  }
  const failing = percentage < passPercent;
  if (grace.applyTo === "failing_only" && !failing) {
    return { percentage, finalMarks, graceApplied: 0 };
  }
  if (grace.applyTo !== "all" && grace.applyTo !== "failing_only" && !failing) {
    // default failing_only
    return { percentage, finalMarks, graceApplied: 0 };
  }

  const ceiling = grace.ceilingPercent ?? passPercent;
  if (percentage >= ceiling) {
    return { percentage, finalMarks, graceApplied: 0 };
  }

  const marksPerPercent = maxMarks > 0 ? maxMarks / 100 : 0;
  const neededPct = Math.min(ceiling, passPercent) - percentage;
  const neededMarks = neededPct * marksPerPercent;
  const graceApplied = Math.min(grace.maxGraceMarks, Math.max(0, neededMarks));
  const newFinal = round4(finalMarks + graceApplied);
  const newPct = maxMarks > 0 ? round4((newFinal / maxMarks) * 100) : percentage;
  return {
    percentage: newPct,
    finalMarks: newFinal,
    graceApplied: round4(graceApplied),
  };
}

/**
 * Deterministic subject result from formula parts + category aggregates.
 * Same inputs ⇒ same outputs.
 */
export function computeSubjectResult(
  input: StudentSubjectCalcInput,
): SubjectCalcOutput {
  const passPercent = input.passPercent ?? input.grace?.passPercent ?? 33;

  if (input.subjectExempt) {
    return {
      studentProfileId: input.studentProfileId,
      subjectId: input.subjectId,
      finalMarks: 0,
      maxMarks: 0,
      percentage: 0,
      letterGrade: null,
      gradePoints: null,
      passStatus: "exempt",
      graceApplied: 0,
      breakdown: { reason: "subject_exempt" },
    };
  }

  const byCat = new Map(input.categories.map((c) => [c.categoryId, c]));
  const contributions: Array<Record<string, unknown>> = [];
  let weightedSum = 0;
  let weightTotal = 0;
  const markRowIds: string[] = [];

  for (const part of input.formulaParts) {
    const cat = byCat.get(part.categoryId);
    if (!cat) {
      contributions.push({
        categoryId: part.categoryId,
        weightPercent: part.weightPercent,
        missing: true,
      });
      continue;
    }
    if (cat.exempt) {
      contributions.push({
        categoryId: part.categoryId,
        weightPercent: part.weightPercent,
        exempt: true,
      });
      continue;
    }
    const contrib = categoryContribution(cat, part.weightPercent);
    weightedSum += contrib.weightedMarks;
    weightTotal += contrib.weightedMax;
    markRowIds.push(...cat.markRowIds);
    contributions.push({
      categoryId: part.categoryId,
      weightPercent: part.weightPercent,
      categoryPct: contrib.pct,
      obtained: cat.obtained,
      maxMarks: cat.maxMarks,
    });
  }

  if (weightTotal <= 0) {
    return {
      studentProfileId: input.studentProfileId,
      subjectId: input.subjectId,
      finalMarks: 0,
      maxMarks: 100,
      percentage: 0,
      letterGrade: null,
      gradePoints: null,
      passStatus: "incomplete",
      graceApplied: 0,
      breakdown: { contributions, markRowIds },
    };
  }

  // Normalize to 100-point scale: weightedSum is already on weight scale (0–100 if parts sum 100)
  const percentage = round4(weightedSum);
  const maxMarks = 100;
  let finalMarks = percentage;
  let graceApplied = 0;

  const graced = applyGrace(
    percentage,
    finalMarks,
    maxMarks,
    input.grace,
    passPercent,
  );
  finalMarks = graced.finalMarks;
  const pctAfter = graced.percentage;
  graceApplied = graced.graceApplied;

  const mapped = mapPercentageToGrade(pctAfter, input.gradeBands);
  let passStatus: PassStatus =
    pctAfter >= passPercent ? "pass" : "fail";

  return {
    studentProfileId: input.studentProfileId,
    subjectId: input.subjectId,
    finalMarks: round4(finalMarks),
    maxMarks,
    percentage: pctAfter,
    letterGrade: mapped.letter,
    gradePoints: mapped.gradePoints,
    passStatus,
    graceApplied,
    breakdown: {
      contributions,
      markRowIds,
      formulaParts: input.formulaParts,
      passPercent,
      percentageBeforeGrace: percentage,
    },
  };
}

/** Average subject percentages → overall (skip exempt / optional excluded). */
export function computeOverallFromSubjects(
  subjects: SubjectCalcOutput[],
  options?: { excludeSubjectIds?: Set<string> },
): Omit<SubjectCalcOutput, "subjectId"> & { subjectId: null } {
  const exclude = options?.excludeSubjectIds ?? new Set();
  const usable = subjects.filter(
    (s) =>
      s.passStatus !== "exempt" &&
      s.passStatus !== "incomplete" &&
      !exclude.has(s.subjectId),
  );
  if (!usable.length) {
    return {
      studentProfileId: subjects[0]?.studentProfileId ?? "",
      subjectId: null,
      finalMarks: 0,
      maxMarks: 100,
      percentage: 0,
      letterGrade: null,
      gradePoints: null,
      passStatus: "incomplete",
      graceApplied: 0,
      breakdown: { subjectCount: 0 },
    };
  }
  const pct =
    usable.reduce((a, s) => a + s.percentage, 0) / usable.length;
  const gpValues = usable
    .map((s) => s.gradePoints)
    .filter((g): g is number => g != null);
  const avgGp =
    gpValues.length > 0
      ? round4(gpValues.reduce((a, b) => a + b, 0) / gpValues.length)
      : null;
  const allPass = usable.every((s) => s.passStatus === "pass");
  return {
    studentProfileId: usable[0].studentProfileId,
    subjectId: null,
    finalMarks: round4(pct),
    maxMarks: 100,
    percentage: round4(pct),
    letterGrade: null,
    gradePoints: avgGp,
    passStatus: allPass ? "pass" : "fail",
    graceApplied: 0,
    breakdown: {
      subjectIds: usable.map((s) => s.subjectId),
      subjectCount: usable.length,
    },
  };
}

/** Default CBSE-like bands for smokes / fallback */
export function defaultGradeBands(): GradeBand[] {
  return [
    { letter: "A1", minPercent: 91, maxPercent: 100, gradePoints: 10 },
    { letter: "A2", minPercent: 81, maxPercent: 90.9999, gradePoints: 9 },
    { letter: "B1", minPercent: 71, maxPercent: 80.9999, gradePoints: 8 },
    { letter: "B2", minPercent: 61, maxPercent: 70.9999, gradePoints: 7 },
    { letter: "C1", minPercent: 51, maxPercent: 60.9999, gradePoints: 6 },
    { letter: "C2", minPercent: 41, maxPercent: 50.9999, gradePoints: 5 },
    { letter: "D", minPercent: 33, maxPercent: 40.9999, gradePoints: 4 },
    { letter: "E", minPercent: 0, maxPercent: 32.9999, gradePoints: 0 },
  ];
}

export function validateFormulaPartsSum(
  parts: FormulaPartInput[],
): string | null {
  const sum = parts.reduce((a, p) => a + p.weightPercent, 0);
  if (Math.abs(sum - 100) > 0.01) {
    return `Formula weights must sum to 100 (got ${sum})`;
  }
  return null;
}
