import type { createClient } from "@/lib/supabase/server";
import type { LockRules } from "@/lib/assessment/types";
import { lockRulesFromJson } from "@/lib/assessment/validation";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export {
  isArchiveBlocked,
  isEditBlocked,
  lockRulesFromJson,
  publishRulesFromJson,
} from "@/lib/assessment/validation";

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

export async function assertTermInYear(
  supabase: Supabase,
  academicYearId: string,
  termId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("terms")
    .select("id")
    .eq("id", termId)
    .eq("academic_year_id", academicYearId)
    .maybeSingle();
  return Boolean(data);
}

export async function assertExamTypeOwned(
  supabase: Supabase,
  schoolId: string,
  examTypeId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("assessment_exam_types")
    .select("id")
    .eq("id", examTypeId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertCategoryOwned(
  supabase: Supabase,
  schoolId: string,
  categoryId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("assessment_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertExamDefinitionOwned(
  supabase: Supabase,
  schoolId: string,
  examDefinitionId: string,
  options?: { allowArchived?: boolean },
): Promise<{
  ok: boolean;
  publishingStatus?: string;
  lockRules?: LockRules;
  archivedAt?: string | null;
}> {
  let query = supabase
    .from("exam_definitions")
    .select(
      "id, publishing_status, lock_rules, archived_at, academic_years!inner(school_id)",
    )
    .eq("id", examDefinitionId)
    .eq("academic_years.school_id", schoolId);

  if (!options?.allowArchived) {
    query = query.is("archived_at", null);
  }

  const { data } = await query.maybeSingle();
  if (!data) {
    return { ok: false };
  }

  return {
    ok: true,
    publishingStatus: data.publishing_status,
    lockRules: lockRulesFromJson(data.lock_rules),
    archivedAt: data.archived_at,
  };
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

export async function assertClassInSchool(
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

export async function assertSubjectGroupOwned(
  supabase: Supabase,
  schoolId: string,
  groupId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("subject_groups")
    .select("id")
    .eq("id", groupId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertGradingScaleOwned(
  supabase: Supabase,
  schoolId: string,
  scaleId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("grading_scales")
    .select("id")
    .eq("id", scaleId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertGradingScaleVersionOwned(
  supabase: Supabase,
  schoolId: string,
  versionId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("grading_scale_versions")
    .select("id, grading_scales!inner(school_id)")
    .eq("id", versionId)
    .eq("grading_scales.school_id", schoolId)
    .maybeSingle();
  return Boolean(data);
}

