import type { createClient } from "@/lib/supabase/server";
import type { FrameworkSnapshot } from "@/lib/assessment-framework/types";
import { buildFrameworkSnapshotJson } from "@/lib/assessment-framework/snapshot";

export { buildFrameworkSnapshotJson };

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

export async function assertFrameworkOwned(
  supabase: Supabase,
  schoolId: string,
  frameworkId: string,
  options?: { allowArchived?: boolean },
): Promise<{
  ok: boolean;
  status?: string;
  subjectId?: string;
  row?: Record<string, unknown>;
}> {
  let query = supabase
    .from("assessment_frameworks")
    .select(
      "id, status, subject_id, class_id, academic_year_id, code, name, description, archived_at",
    )
    .eq("id", frameworkId)
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

export async function loadFrameworkTree(
  supabase: Supabase,
  schoolId: string,
  frameworkId: string,
): Promise<FrameworkSnapshot | null> {
  const owned = await assertFrameworkOwned(supabase, schoolId, frameworkId);
  if (!owned.ok || !owned.row) return null;

  const [cats, formulas, parts] = await Promise.all([
    supabase
      .from("assessment_framework_categories")
      .select("*")
      .eq("framework_id", frameworkId)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .order("display_order"),
    supabase
      .from("assessment_framework_formulas")
      .select("*")
      .eq("framework_id", frameworkId)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .order("display_order"),
    supabase
      .from("assessment_framework_formula_parts")
      .select("*")
      .eq("framework_id", frameworkId)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .order("display_order"),
  ]);

  return {
    framework: owned.row,
    categories: (cats.data ?? []) as Array<Record<string, unknown>>,
    formulas: (formulas.data ?? []) as Array<Record<string, unknown>>,
    formulaParts: (parts.data ?? []) as Array<Record<string, unknown>>,
  };
}

export async function getLatestFrameworkVersionNumber(
  supabase: Supabase,
  frameworkId: string,
): Promise<number> {
  const { data } = await supabase
    .from("assessment_framework_versions")
    .select("version")
    .eq("framework_id", frameworkId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.version ?? 0;
}

export async function getCurrentFrameworkVersion(
  supabase: Supabase,
  frameworkId: string,
) {
  const { data } = await supabase
    .from("assessment_framework_versions")
    .select(
      "id, version, snapshot, change_summary, published_at, is_immutable, is_current, created_at",
    )
    .eq("framework_id", frameworkId)
    .eq("is_current", true)
    .maybeSingle();
  return data;
}
