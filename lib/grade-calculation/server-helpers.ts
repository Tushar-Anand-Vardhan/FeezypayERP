import type { createClient } from "@/lib/supabase/server";
import type { GradeBand } from "@/lib/grade-calculation/types";
import { defaultGradeBands } from "@/lib/grade-calculation/compute";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function assertFrameworkVersionOwned(
  supabase: Supabase,
  schoolId: string,
  frameworkId: string,
  versionId: string,
): Promise<boolean> {
  const { data: fw } = await supabase
    .from("assessment_frameworks")
    .select("id")
    .eq("id", frameworkId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!fw) return false;
  const { data: ver } = await supabase
    .from("assessment_framework_versions")
    .select("id")
    .eq("id", versionId)
    .eq("framework_id", frameworkId)
    .maybeSingle();
  return Boolean(ver);
}

export function bandsFromMapping(
  mapping: Record<string, unknown> | null | undefined,
): GradeBand[] {
  if (!mapping || typeof mapping !== "object") return defaultGradeBands();
  const bands = mapping.bands;
  if (!Array.isArray(bands) || !bands.length) return defaultGradeBands();
  const out: GradeBand[] = [];
  for (const b of bands) {
    if (!b || typeof b !== "object") continue;
    const row = b as Record<string, unknown>;
    if (typeof row.letter !== "string") continue;
    out.push({
      letter: row.letter,
      minPercent: Number(row.minPercent ?? row.min ?? 0),
      maxPercent: Number(row.maxPercent ?? row.max ?? 100),
      gradePoints:
        row.gradePoints != null ? Number(row.gradePoints) : undefined,
    });
  }
  return out.length ? out : defaultGradeBands();
}

/**
 * Aggregate locked assessment records under a category for one student.
 * Average of current marks across locked records.
 */
export async function loadCategoryAggregateForStudent(
  supabase: Supabase,
  schoolId: string,
  categoryId: string,
  studentProfileId: string,
): Promise<{
  obtained: number;
  maxMarks: number;
  markRowIds: string[];
} | null> {
  const { data: records } = await supabase
    .from("assessment_records")
    .select("id, max_marks, status")
    .eq("school_id", schoolId)
    .eq("framework_category_id", categoryId)
    .eq("status", "locked")
    .is("archived_at", null);

  if (!records?.length) return null;

  let sumPct = 0;
  let count = 0;
  const markRowIds: string[] = [];
  let avgMax = 0;

  for (const rec of records) {
    const { data: mark } = await supabase
      .from("assessment_record_marks")
      .select("id, marks_obtained, is_absent")
      .eq("record_id", rec.id)
      .eq("student_profile_id", studentProfileId)
      .eq("is_current", true)
      .is("superseded_at", null)
      .maybeSingle();

    if (!mark || mark.is_absent) continue;
    const max = Number(rec.max_marks);
    const obtained = Number(mark.marks_obtained ?? 0);
    if (max <= 0) continue;
    sumPct += (obtained / max) * 100;
    avgMax += max;
    count += 1;
    markRowIds.push(mark.id);
  }

  if (!count) return null;
  const pct = sumPct / count;
  const maxMarks = 100;
  return {
    obtained: (pct / 100) * maxMarks,
    maxMarks,
    markRowIds,
  };
}
