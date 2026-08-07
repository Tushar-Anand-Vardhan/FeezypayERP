"use server";

import { recordFrameworkMutation } from "@/lib/assessment-framework/audit";
import { ensureFrameworkCode } from "@/lib/assessment-framework/codes";
import {
  assertClassOwned,
  assertFrameworkOwned,
  assertSubjectOwned,
  assertYearOwned,
  buildFrameworkSnapshotJson,
  getActorId,
  getCurrentFrameworkVersion,
  getLatestFrameworkVersionNumber,
  loadFrameworkTree,
} from "@/lib/assessment-framework/server-helpers";
import type {
  CloneFrameworkInput,
  FrameworkActionResult,
  FrameworkInput,
} from "@/lib/assessment-framework/types";
import {
  validateCloneFrameworkInput,
  validateFrameworkInput,
} from "@/lib/assessment-framework/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listFrameworksAction(options?: {
  academicYearId?: string;
  classId?: string;
  subjectId?: string;
  includeArchived?: boolean;
}): Promise<
  | { success: true; frameworks: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_framework.read",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  let query = supabase
    .from("assessment_frameworks")
    .select(
      "id, academic_year_id, class_id, subject_id, code, name, description, status, archived_at, created_at, updated_at",
    )
    .eq("school_id", schoolId)
    .order("name");

  if (!options?.includeArchived) query = query.is("archived_at", null);
  if (options?.academicYearId) {
    query = query.eq("academic_year_id", options.academicYearId);
  }
  if (options?.classId) query = query.eq("class_id", options.classId);
  if (options?.subjectId) query = query.eq("subject_id", options.subjectId);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, frameworks: data ?? [] };
}

export async function createFrameworkAction(
  input: FrameworkInput,
): Promise<FrameworkActionResult> {
  const fieldErrors = validateFrameworkInput(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext(
    "assessment_framework.edit",
    { subjectId: input.subjectId },
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found" };
  }
  if (!(await assertSubjectOwned(supabase, schoolId, input.subjectId))) {
    return { success: false, error: "Subject not found" };
  }
  if (!(await assertClassOwned(supabase, schoolId, input.classId))) {
    return { success: false, error: "Class not found" };
  }

  const code = ensureFrameworkCode(input.name, input.code);
  const row = {
    school_id: schoolId,
    academic_year_id: input.academicYearId,
    class_id: input.classId,
    subject_id: input.subjectId,
    code,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    status: "draft",
    created_by: actorId,
    updated_by: actorId,
  };

  const { data, error } = await supabase
    .from("assessment_frameworks")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data?.id) return { success: false, error: "Insert failed" };

  await recordFrameworkMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityId: data.id,
    action: "create",
    after: row,
  });

  return { success: true, id: data.id };
}

export async function updateFrameworkAction(
  frameworkId: string,
  input: Partial<FrameworkInput> & { name?: string },
): Promise<FrameworkActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_framework.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertFrameworkOwned(supabase, schoolId, frameworkId);
  if (!owned.ok) return { success: false, error: "Framework not found" };
  if (owned.status === "retired") {
    return { success: false, error: "Cannot edit retired framework" };
  }

  const actorId = await getActorId(supabase);
  const patch: Record<string, unknown> = {
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };
  if (input.name != null) patch.name = input.name.trim();
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.code != null) {
    patch.code = ensureFrameworkCode(
      input.name ?? String(owned.row?.name),
      input.code,
    );
  }

  const { error } = await supabase
    .from("assessment_frameworks")
    .update(patch)
    .eq("id", frameworkId)
    .eq("school_id", schoolId);

  if (error) return { success: false, error: error.message };

  await recordFrameworkMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityId: frameworkId,
    action: "update",
    before: owned.row,
    after: { ...owned.row, ...patch },
  });

  return { success: true, id: frameworkId };
}

export async function archiveFrameworkAction(
  frameworkId: string,
): Promise<FrameworkActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_framework.archive",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertFrameworkOwned(supabase, schoolId, frameworkId);
  if (!owned.ok) return { success: false, error: "Framework not found" };

  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("assessment_frameworks")
    .update({
      archived_at: now,
      status: "retired",
      updated_by: actorId,
      updated_at: now,
    })
    .eq("id", frameworkId)
    .eq("school_id", schoolId);

  if (error) return { success: false, error: error.message };

  await recordFrameworkMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityId: frameworkId,
    action: "archive",
    before: owned.row,
    after: { ...owned.row, archived_at: now, status: "retired" },
  });

  return { success: true, id: frameworkId };
}

export async function publishFrameworkAction(
  frameworkId: string,
  changeSummary?: string,
): Promise<FrameworkActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_framework.publish",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertFrameworkOwned(supabase, schoolId, frameworkId);
  if (!owned.ok) return { success: false, error: "Framework not found" };
  if (owned.status === "retired") {
    return { success: false, error: "Cannot publish retired framework" };
  }

  const tree = await loadFrameworkTree(supabase, schoolId, frameworkId);
  if (!tree) return { success: false, error: "Failed to load framework" };

  const actorId = await getActorId(supabase);
  const nextVersion =
    (await getLatestFrameworkVersionNumber(supabase, frameworkId)) + 1;
  const snapshot = buildFrameworkSnapshotJson(tree);
  const now = new Date().toISOString();

  await supabase
    .from("assessment_framework_versions")
    .update({ is_current: false })
    .eq("framework_id", frameworkId)
    .eq("is_current", true);

  const { data: versionRow, error: vErr } = await supabase
    .from("assessment_framework_versions")
    .insert({
      framework_id: frameworkId,
      version: nextVersion,
      snapshot,
      change_summary: changeSummary?.trim() || null,
      published_at: now,
      is_immutable: true,
      is_current: true,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (vErr) return { success: false, error: vErr.message };
  if (!versionRow?.id) return { success: false, error: "Version insert failed" };

  const { error: pErr } = await supabase
    .from("assessment_frameworks")
    .update({
      status: "published",
      updated_by: actorId,
      updated_at: now,
    })
    .eq("id", frameworkId)
    .eq("school_id", schoolId);

  if (pErr) return { success: false, error: pErr.message };

  await recordFrameworkMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityId: frameworkId,
    action: "publish_version",
    before: owned.row,
    after: { ...owned.row, status: "published" },
    versionLabel: `v${nextVersion}`,
    localAction: "publish",
    metadata: { assessment_framework_version_id: versionRow.id },
  });

  return { success: true, id: frameworkId, versionId: versionRow.id };
}

export async function cloneFrameworkAction(
  input: CloneFrameworkInput,
): Promise<FrameworkActionResult> {
  const fieldErrors = validateCloneFrameworkInput(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext(
    "assessment_framework.clone",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const source = await assertFrameworkOwned(
    supabase,
    schoolId,
    input.sourceFrameworkId,
    { allowArchived: true },
  );
  if (!source.ok || !source.row) {
    return { success: false, error: "Source framework not found" };
  }

  if (!(await assertYearOwned(supabase, schoolId, input.targetAcademicYearId))) {
    return { success: false, error: "Target academic year not found" };
  }

  const targetClassId =
    input.targetClassId?.trim() || String(source.row.class_id);
  const targetSubjectId =
    input.targetSubjectId?.trim() || String(source.row.subject_id);

  if (!(await assertClassOwned(supabase, schoolId, targetClassId))) {
    return { success: false, error: "Target class not found" };
  }
  if (!(await assertSubjectOwned(supabase, schoolId, targetSubjectId))) {
    return { success: false, error: "Target subject not found" };
  }

  const tree = await loadFrameworkTree(
    supabase,
    schoolId,
    input.sourceFrameworkId,
  );
  if (!tree) return { success: false, error: "Failed to load source tree" };

  const currentVersion = await getCurrentFrameworkVersion(
    supabase,
    input.sourceFrameworkId,
  );
  const actorId = await getActorId(supabase);
  const name =
    input.name?.trim() || `${String(source.row.name)} (clone)`;
  const code = ensureFrameworkCode(
    name,
    input.code ?? `${String(source.row.code)}_CLONE`,
  );
  const now = new Date().toISOString();

  const { data: newFw, error: packErr } = await supabase
    .from("assessment_frameworks")
    .insert({
      school_id: schoolId,
      academic_year_id: input.targetAcademicYearId,
      class_id: targetClassId,
      subject_id: targetSubjectId,
      code,
      name,
      description: source.row.description ?? null,
      status: "draft",
      cloned_from_framework_id: input.sourceFrameworkId,
      cloned_from_version_id: currentVersion?.id ?? null,
      cloned_at: now,
      cloned_by: actorId,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (packErr) return { success: false, error: packErr.message };
  if (!newFw?.id) return { success: false, error: "Clone insert failed" };

  const categoryIdMap = new Map<string, string>();

  for (const c of tree.categories) {
    const { data } = await supabase
      .from("assessment_framework_categories")
      .insert({
        school_id: schoolId,
        framework_id: newFw.id,
        assessment_category_id: c.assessment_category_id,
        code: c.code,
        name: c.name,
        category_kind: c.category_kind,
        description: c.description,
        weightage_percent: c.weightage_percent,
        max_marks: c.max_marks,
        pass_marks: c.pass_marks,
        grade_mapping: c.grade_mapping ?? {},
        grading_scale_version_id: c.grading_scale_version_id,
        included_in_final_grade: c.included_in_final_grade,
        term_id: c.term_id,
        visibility: c.visibility,
        report_card_mapping: c.report_card_mapping ?? {},
        display_order: c.display_order,
      })
      .select("id")
      .maybeSingle();
    if (data?.id) categoryIdMap.set(String(c.id), data.id);
  }

  const formulaIdMap = new Map<string, string>();
  for (const f of tree.formulas) {
    const { data } = await supabase
      .from("assessment_framework_formulas")
      .insert({
        school_id: schoolId,
        framework_id: newFw.id,
        code: f.code,
        name: f.name,
        description: f.description,
        term_id: f.term_id,
        formula_kind: f.formula_kind,
        expression: f.expression ?? {},
        is_final_grade: f.is_final_grade,
        display_order: f.display_order,
      })
      .select("id")
      .maybeSingle();
    if (data?.id) formulaIdMap.set(String(f.id), data.id);
  }

  for (const p of tree.formulaParts) {
    const formulaId = formulaIdMap.get(String(p.formula_id));
    const categoryId = categoryIdMap.get(String(p.category_id));
    if (!formulaId || !categoryId) continue;
    await supabase.from("assessment_framework_formula_parts").insert({
      school_id: schoolId,
      framework_id: newFw.id,
      formula_id: formulaId,
      category_id: categoryId,
      weight_percent: p.weight_percent,
      display_order: p.display_order,
    });
  }

  await recordFrameworkMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityId: newFw.id,
    action: "duplicate",
    after: { id: newFw.id, cloned_from: input.sourceFrameworkId },
    localAction: "clone",
    metadata: {
      source_framework_id: input.sourceFrameworkId,
      cloned_from_version_id: currentVersion?.id ?? null,
    },
  });

  return { success: true, id: newFw.id };
}
