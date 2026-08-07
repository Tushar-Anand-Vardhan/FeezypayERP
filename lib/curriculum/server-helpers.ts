import type { createClient } from "@/lib/supabase/server";
import type { CurriculumSnapshot } from "@/lib/curriculum/types";
import { buildSnapshotJson } from "@/lib/curriculum/snapshot";

export { buildSnapshotJson } from "@/lib/curriculum/snapshot";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function assertYearOwned(
  supabase: Supabase,
  schoolId: string,
  academicYearId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", academicYearId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertSubjectOwned(
  supabase: Supabase,
  schoolId: string,
  subjectId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertClassOwned(
  supabase: Supabase,
  schoolId: string,
  classId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("classes")
    .select("id, academic_years!inner(school_id)")
    .eq("id", classId)
    .eq("academic_years.school_id", schoolId)
    .maybeSingle();
  return Boolean(data);
}

export async function assertCurriculumOwned(
  supabase: Supabase,
  schoolId: string,
  curriculumId: string,
  options?: { allowArchived?: boolean },
): Promise<{
  ok: boolean;
  status?: string;
  subjectId?: string;
  row?: Record<string, unknown>;
}> {
  let query = supabase
    .from("curricula")
    .select(
      "id, status, subject_id, class_id, academic_year_id, code, name, description, board_id, board_code, suggested_total_hours, archived_at",
    )
    .eq("id", curriculumId)
    .eq("school_id", schoolId);

  if (!options?.allowArchived) {
    query = query.is("archived_at", null);
  }

  const { data } = await query.maybeSingle();
  if (!data) return { ok: false };
  return {
    ok: true,
    status: data.status,
    subjectId: data.subject_id,
    row: data as Record<string, unknown>,
  };
}

export async function loadCurriculumTree(
  supabase: Supabase,
  schoolId: string,
  curriculumId: string,
): Promise<CurriculumSnapshot | null> {
  const owned = await assertCurriculumOwned(supabase, schoolId, curriculumId);
  if (!owned.ok || !owned.row) return null;

  const [
    unitsRes,
    chaptersRes,
    topicsRes,
    subtopicsRes,
    loRes,
    compRes,
    linkRes,
    resRes,
  ] = await Promise.all([
    supabase
      .from("curriculum_units")
      .select("*")
      .eq("curriculum_id", curriculumId)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .order("display_order"),
    supabase
      .from("curriculum_chapters")
      .select("*")
      .eq("curriculum_id", curriculumId)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .order("display_order"),
    supabase
      .from("curriculum_topics")
      .select("*")
      .eq("curriculum_id", curriculumId)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .order("display_order"),
    supabase
      .from("curriculum_subtopics")
      .select("*")
      .eq("curriculum_id", curriculumId)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .order("display_order"),
    supabase
      .from("curriculum_learning_outcomes")
      .select("*")
      .eq("curriculum_id", curriculumId)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .order("display_order"),
    supabase
      .from("curriculum_competencies")
      .select("*")
      .eq("curriculum_id", curriculumId)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .order("display_order"),
    supabase
      .from("curriculum_outcome_competencies")
      .select("*")
      .eq("curriculum_id", curriculumId)
      .eq("school_id", schoolId)
      .is("archived_at", null),
    supabase
      .from("curriculum_resources")
      .select("*")
      .eq("curriculum_id", curriculumId)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .order("display_order"),
  ]);

  return {
    pack: owned.row,
    units: (unitsRes.data ?? []) as Array<Record<string, unknown>>,
    chapters: (chaptersRes.data ?? []) as Array<Record<string, unknown>>,
    topics: (topicsRes.data ?? []) as Array<Record<string, unknown>>,
    subtopics: (subtopicsRes.data ?? []) as Array<Record<string, unknown>>,
    learningOutcomes: (loRes.data ?? []) as Array<Record<string, unknown>>,
    competencies: (compRes.data ?? []) as Array<Record<string, unknown>>,
    outcomeCompetencies: (linkRes.data ?? []) as Array<Record<string, unknown>>,
    resources: (resRes.data ?? []) as Array<Record<string, unknown>>,
  };
}

export async function getLatestVersionNumber(
  supabase: Supabase,
  curriculumId: string,
): Promise<number> {
  const { data } = await supabase
    .from("curriculum_versions")
    .select("version")
    .eq("curriculum_id", curriculumId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.version ?? 0;
}

export async function getCurrentVersion(
  supabase: Supabase,
  curriculumId: string,
) {
  const { data } = await supabase
    .from("curriculum_versions")
    .select(
      "id, version, snapshot, change_summary, published_at, is_immutable, is_current, created_at",
    )
    .eq("curriculum_id", curriculumId)
    .eq("is_current", true)
    .maybeSingle();
  return data;
}
