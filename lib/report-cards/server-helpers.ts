import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function assertBoardOwned(
  supabase: Supabase,
  schoolId: string,
  boardId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("report_card_boards")
    .select("id")
    .eq("id", boardId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertTemplateOwned(
  supabase: Supabase,
  schoolId: string,
  templateId: string,
  options?: { allowArchived?: boolean },
): Promise<{ ok: boolean; status?: string }> {
  let query = supabase
    .from("report_card_templates")
    .select("id, status")
    .eq("id", templateId)
    .eq("school_id", schoolId);

  if (!options?.allowArchived) {
    query = query.is("archived_at", null);
  }

  const { data } = await query.maybeSingle();
  if (!data) {
    return { ok: false };
  }
  return { ok: true, status: data.status };
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

export async function assertSectionInSchool(
  supabase: Supabase,
  schoolId: string,
  sectionId: string,
): Promise<{ ok: boolean; classId?: string }> {
  const { data } = await supabase
    .from("sections")
    .select("id, class_id, classes!inner(academic_years!inner(school_id))")
    .eq("id", sectionId)
    .eq("classes.academic_years.school_id", schoolId)
    .maybeSingle();
  if (!data) {
    return { ok: false };
  }
  return { ok: true, classId: data.class_id };
}

export async function assertExamDefinitionInSchool(
  supabase: Supabase,
  schoolId: string,
  examDefinitionId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("exam_definitions")
    .select("id, academic_years!inner(school_id)")
    .eq("id", examDefinitionId)
    .eq("academic_years.school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function buildTemplateSnapshot(
  supabase: Supabase,
  templateId: string,
): Promise<Record<string, unknown>> {
  const [
    { data: template },
    { data: blocks },
    { data: assessments },
    { data: scopes },
    { data: signatures },
  ] = await Promise.all([
    supabase
      .from("report_card_templates")
      .select(
        "id, code, name, description, board_id, academic_year_id, term_id, status, layout_config, include_grades, include_remarks, include_attendance, include_co_curricular, include_teacher_comments, include_principal_comments, include_signatures, pdf_generation_enabled, digital_signature_enabled",
      )
      .eq("id", templateId)
      .maybeSingle(),
    supabase
      .from("report_card_template_blocks")
      .select(
        "id, block_type, title, config, display_order, is_visible",
      )
      .eq("template_id", templateId)
      .is("archived_at", null)
      .order("display_order"),
    supabase
      .from("report_card_template_assessments")
      .select(
        "id, exam_definition_id, display_label, display_order, include_components, show_max_marks, show_pass_marks, show_grades",
      )
      .eq("template_id", templateId)
      .is("archived_at", null)
      .order("display_order"),
    supabase
      .from("report_card_template_scopes")
      .select("id, class_id, section_id, display_order")
      .eq("template_id", templateId)
      .is("archived_at", null)
      .order("display_order"),
    supabase
      .from("report_card_template_signatures")
      .select(
        "id, role_label, signature_type, display_order, requires_digital",
      )
      .eq("template_id", templateId)
      .is("archived_at", null)
      .order("display_order"),
  ]);

  return {
    template: template ?? null,
    blocks: blocks ?? [],
    assessments: assessments ?? [],
    scopes: scopes ?? [],
    signatures: signatures ?? [],
    note: "Assessment marks are never copied; exam_definition_id refs E11.",
  };
}
