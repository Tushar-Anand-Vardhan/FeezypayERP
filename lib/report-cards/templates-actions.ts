"use server";

import { revalidatePath } from "next/cache";
import {
  assertBoardOwned,
  assertTemplateOwned,
  assertTermInYear,
  assertYearOwned,
  buildTemplateSnapshot,
  getActorId,
} from "@/lib/report-cards/server-helpers";
import {
  DEFAULT_BLOCK_BLUEPRINT,
  type ReportCardActionResult,
  type TemplateInput,
} from "@/lib/report-cards/types";
import {
  ensureTemplateCode,
  isTemplateMutable,
  layoutConfigToJson,
  validateTemplateInput,
} from "@/lib/report-cards/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/report-cards");
}

const TEMPLATE_SELECT =
  "id, code, name, description, board_id, academic_year_id, term_id, status, layout_config, include_grades, include_remarks, include_attendance, include_co_curricular, include_teacher_comments, include_principal_comments, include_signatures, pdf_generation_enabled, digital_signature_enabled, archived_at";

export async function listReportCardTemplatesAction(options?: {
  includeArchived?: boolean;
  academicYearId?: string;
  boardId?: string;
}): Promise<
  | { success: true; templates: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("report_card_templates")
    .select(TEMPLATE_SELECT)
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (options?.academicYearId) {
    query = query.eq("academic_year_id", options.academicYearId);
  }
  if (options?.boardId) {
    query = query.eq("board_id", options.boardId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, templates: data ?? [] };
}

export async function upsertReportCardTemplateAction(
  input: TemplateInput,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateTemplateInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;

  if (input.id) {
    const owned = await assertTemplateOwned(supabase, schoolId, input.id);
    if (!owned.ok) {
      return { success: false, error: "Template not found." };
    }
    if (!isTemplateMutable(owned.status)) {
      return {
        success: false,
        error: "Only draft templates can be edited. Retire and clone, or create a new draft.",
      };
    }
  }

  if (input.boardId) {
    if (!(await assertBoardOwned(supabase, schoolId, input.boardId))) {
      return { success: false, error: "Board not found." };
    }
  }

  if (input.academicYearId) {
    if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
      return { success: false, error: "Academic year not found." };
    }
    if (input.termId) {
      if (
        !(await assertTermInYear(supabase, input.academicYearId, input.termId))
      ) {
        return { success: false, error: "Term not found in this year." };
      }
    }
  } else if (input.termId) {
    return {
      success: false,
      error: "Academic year is required when setting a term.",
    };
  }

  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const payload = {
    school_id: schoolId,
    code: ensureTemplateCode(input.name, input.code),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    board_id: input.boardId || null,
    academic_year_id: input.academicYearId || null,
    term_id: input.termId || null,
    layout_config: layoutConfigToJson(input.layoutConfig),
    include_grades: input.includeGrades ?? true,
    include_remarks: input.includeRemarks ?? true,
    include_attendance: input.includeAttendance ?? true,
    include_co_curricular: input.includeCoCurricular ?? true,
    include_teacher_comments: input.includeTeacherComments ?? true,
    include_principal_comments: input.includePrincipalComments ?? true,
    include_signatures: input.includeSignatures ?? true,
    pdf_generation_enabled: input.pdfGenerationEnabled ?? false,
    digital_signature_enabled: input.digitalSignatureEnabled ?? false,
    updated_by: actorId,
    updated_at: now,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("report_card_templates")
      .update(payload)
      .eq("id", input.id)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Could not update template.",
      };
    }

    revalidate();
    return { success: true, message: "Template updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("report_card_templates")
    .insert({
      ...payload,
      status: "draft",
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create template.",
    };
  }

  // Seed default dynamic sections for new templates.
  await supabase.from("report_card_template_blocks").insert(
    DEFAULT_BLOCK_BLUEPRINT.map((block) => ({
      template_id: data.id,
      block_type: block.blockType,
      title: block.title,
      display_order: block.displayOrder,
      is_visible: true,
      created_by: actorId,
    })),
  );

  await supabase.from("report_card_template_signatures").insert([
    {
      template_id: data.id,
      role_label: "Class Teacher",
      signature_type: "wet_ink",
      display_order: 1,
      created_by: actorId,
    },
    {
      template_id: data.id,
      role_label: "Principal",
      signature_type: "wet_ink",
      display_order: 2,
      created_by: actorId,
    },
  ]);

  revalidate();
  return { success: true, message: "Template created.", id: data.id };
}

export async function publishReportCardTemplateAction(
  templateId: string,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertTemplateOwned(supabase, schoolId, templateId);
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }
  if (owned.status === "retired") {
    return { success: false, error: "Retired templates cannot be published." };
  }
  if (owned.status !== "draft") {
    return {
      success: false,
      error: "Only draft templates can be published. Clone as draft to revise.",
    };
  }

  const { count: assessmentCount } = await supabase
    .from("report_card_template_assessments")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId)
    .is("archived_at", null);

  if ((assessmentCount ?? 0) === 0) {
    return {
      success: false,
      error: "Bind at least one assessment before publishing.",
    };
  }

  const snapshot = await buildTemplateSnapshot(supabase, templateId);
  const actorId = await getActorId(supabase);

  const { data: latest } = await supabase
    .from("report_card_template_versions")
    .select("version")
    .eq("template_id", templateId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;
  const { error: versionError } = await supabase
    .from("report_card_template_versions")
    .insert({
      template_id: templateId,
      version: nextVersion,
      snapshot,
      published_at: new Date().toISOString(),
      is_immutable: true,
      created_by: actorId,
    });

  if (versionError) {
    return { success: false, error: versionError.message };
  }

  const { error } = await supabase
    .from("report_card_templates")
    .update({
      status: "published",
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return {
    success: true,
    message: `Template published as version ${nextVersion}.`,
    id: templateId,
  };
}

export async function retireReportCardTemplateAction(
  templateId: string,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertTemplateOwned(supabase, schoolId, templateId);
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("report_card_templates")
    .update({
      status: "retired",
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Template retired.", id: templateId };
}

export async function archiveReportCardTemplateAction(
  templateId: string,
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertTemplateOwned(supabase, schoolId, templateId);
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("report_card_templates")
    .update({
      archived_at: new Date().toISOString(),
      status: "retired",
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Template archived.", id: templateId };
}

export async function listReportCardTemplateVersionsAction(
  templateId: string,
): Promise<
  | {
      success: true;
      versions: Array<{
        id: string;
        version: number;
        published_at: string;
        is_immutable: boolean;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertTemplateOwned(supabase, schoolId, templateId, {
    allowArchived: true,
  });
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }

  const { data, error } = await supabase
    .from("report_card_template_versions")
    .select("id, version, published_at, is_immutable")
    .eq("template_id", templateId)
    .order("version", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, versions: data ?? [] };
}

/**
 * Create a new draft template cloned from a published/retired template's latest snapshot.
 * Structural edits after publish go through clone → edit → publish (versioning).
 */
export async function cloneReportCardTemplateAsDraftAction(
  templateId: string,
  options?: { name?: string },
): Promise<ReportCardActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertTemplateOwned(supabase, schoolId, templateId, {
    allowArchived: true,
  });
  if (!owned.ok) {
    return { success: false, error: "Template not found." };
  }

  const { data: source } = await supabase
    .from("report_card_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", templateId)
    .maybeSingle();

  if (!source) {
    return { success: false, error: "Template not found." };
  }

  const actorId = await getActorId(supabase);
  const name = options?.name?.trim() || `${source.name} (copy)`;
  const { data: created, error } = await supabase
    .from("report_card_templates")
    .insert({
      school_id: schoolId,
      code: ensureTemplateCode(name),
      name,
      description: source.description,
      board_id: source.board_id,
      academic_year_id: source.academic_year_id,
      term_id: source.term_id,
      status: "draft",
      layout_config: source.layout_config ?? {},
      include_grades: source.include_grades,
      include_remarks: source.include_remarks,
      include_attendance: source.include_attendance,
      include_co_curricular: source.include_co_curricular,
      include_teacher_comments: source.include_teacher_comments,
      include_principal_comments: source.include_principal_comments,
      include_signatures: source.include_signatures,
      pdf_generation_enabled: source.pdf_generation_enabled,
      digital_signature_enabled: source.digital_signature_enabled,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    return {
      success: false,
      error: error?.message ?? "Could not clone template.",
    };
  }

  const [
    { data: blocks },
    { data: assessments },
    { data: scopes },
    { data: signatures },
  ] = await Promise.all([
    supabase
      .from("report_card_template_blocks")
      .select("block_type, title, config, display_order, is_visible")
      .eq("template_id", templateId)
      .is("archived_at", null),
    supabase
      .from("report_card_template_assessments")
      .select(
        "exam_definition_id, display_label, display_order, include_components, show_max_marks, show_pass_marks, show_grades",
      )
      .eq("template_id", templateId)
      .is("archived_at", null),
    supabase
      .from("report_card_template_scopes")
      .select("class_id, section_id, display_order")
      .eq("template_id", templateId)
      .is("archived_at", null),
    supabase
      .from("report_card_template_signatures")
      .select("role_label, signature_type, display_order, requires_digital")
      .eq("template_id", templateId)
      .is("archived_at", null),
  ]);

  if (blocks && blocks.length > 0) {
    await supabase.from("report_card_template_blocks").insert(
      blocks.map((row) => ({
        ...row,
        template_id: created.id,
        created_by: actorId,
      })),
    );
  }
  if (assessments && assessments.length > 0) {
    await supabase.from("report_card_template_assessments").insert(
      assessments.map((row) => ({
        ...row,
        template_id: created.id,
        created_by: actorId,
      })),
    );
  }
  if (scopes && scopes.length > 0) {
    await supabase.from("report_card_template_scopes").insert(
      scopes.map((row) => ({
        ...row,
        template_id: created.id,
        created_by: actorId,
      })),
    );
  }
  if (signatures && signatures.length > 0) {
    await supabase.from("report_card_template_signatures").insert(
      signatures.map((row) => ({
        ...row,
        template_id: created.id,
        created_by: actorId,
      })),
    );
  }

  revalidate();
  return {
    success: true,
    message: "Draft template cloned.",
    id: created.id,
  };
}
