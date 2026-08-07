import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function assertRecordOwned(
  supabase: Supabase,
  schoolId: string,
  recordId: string,
  options?: { allowArchived?: boolean },
): Promise<{
  ok: boolean;
  status?: string;
  maxMarks?: number;
  authorEmploymentId?: string;
  row?: Record<string, unknown>;
}> {
  let query = supabase
    .from("assessment_records")
    .select(
      "id, status, max_marks, author_employment_id, class_id, section_id, subject_id, framework_category_id, assessment_framework_version_id, locked_at, archived_at",
    )
    .eq("id", recordId)
    .eq("school_id", schoolId);

  if (!options?.allowArchived) {
    query = query.is("archived_at", null);
  }

  const { data } = await query.maybeSingle();
  if (!data) return { ok: false };
  return {
    ok: true,
    status: data.status,
    maxMarks: Number(data.max_marks),
    authorEmploymentId: data.author_employment_id,
    row: data as Record<string, unknown>,
  };
}

export async function assertCategoryOnFramework(
  supabase: Supabase,
  schoolId: string,
  frameworkId: string,
  categoryId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("assessment_framework_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("framework_id", frameworkId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertFrameworkVersion(
  supabase: Supabase,
  frameworkId: string,
  versionId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("assessment_framework_versions")
    .select("id")
    .eq("id", versionId)
    .eq("framework_id", frameworkId)
    .maybeSingle();
  return Boolean(data);
}

export async function assertSectionInSchool(
  supabase: Supabase,
  schoolId: string,
  sectionId: string,
): Promise<{ ok: boolean; classId?: string }> {
  const { data: section } = await supabase
    .from("sections")
    .select("id, class_id")
    .eq("id", sectionId)
    .maybeSingle();
  if (!section) return { ok: false };

  const { data: klass } = await supabase
    .from("classes")
    .select("id, academic_years!inner(school_id)")
    .eq("id", section.class_id)
    .eq("academic_years.school_id", schoolId)
    .maybeSingle();
  if (!klass) return { ok: false };
  return { ok: true, classId: section.class_id as string };
}

export function recordIsEditable(status: string | undefined): boolean {
  return status === "draft" || status === "open";
}
