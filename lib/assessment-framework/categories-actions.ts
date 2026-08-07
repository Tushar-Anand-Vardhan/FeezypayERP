"use server";

import { writeFrameworkAudit } from "@/lib/assessment-framework/audit";
import { ensureCategoryCode } from "@/lib/assessment-framework/codes";
import {
  assertFrameworkOwned,
  getActorId,
} from "@/lib/assessment-framework/server-helpers";
import type {
  FrameworkActionResult,
  FrameworkCategoryInput,
} from "@/lib/assessment-framework/types";
import { validateCategoryInput } from "@/lib/assessment-framework/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function upsertFrameworkCategoryAction(
  input: FrameworkCategoryInput & { id?: string },
): Promise<FrameworkActionResult> {
  const fieldErrors = validateCategoryInput(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext(
    "assessment_framework.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertFrameworkOwned(
    supabase,
    schoolId,
    input.frameworkId,
  );
  if (!owned.ok) return { success: false, error: "Framework not found" };
  if (owned.status === "retired") {
    return { success: false, error: "Cannot edit retired framework" };
  }

  const actorId = await getActorId(supabase);
  const row = {
    school_id: schoolId,
    framework_id: input.frameworkId,
    name: input.name.trim(),
    code: ensureCategoryCode(input.name, input.code),
    category_kind: input.categoryKind ?? "custom",
    assessment_category_id: input.assessmentCategoryId ?? null,
    description: input.description?.trim() || null,
    weightage_percent: input.weightagePercent ?? null,
    max_marks: input.maxMarks ?? null,
    pass_marks: input.passMarks ?? null,
    grade_mapping: input.gradeMapping ?? {},
    grading_scale_version_id: input.gradingScaleVersionId ?? null,
    included_in_final_grade: input.includedInFinalGrade ?? true,
    term_id: input.termId ?? null,
    visibility: input.visibility ?? "teachers",
    report_card_mapping: input.reportCardMapping ?? {},
    display_order: input.displayOrder ?? 0,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("assessment_framework_categories")
      .update(row)
      .eq("id", input.id)
      .eq("school_id", schoolId);
    if (error) return { success: false, error: error.message };
    await writeFrameworkAudit(supabase, {
      schoolId,
      action: "category.update",
      entityType: "framework_category",
      entityId: input.id,
      actorAuthUserId: actorId,
      newValues: row,
    });
    return { success: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("assessment_framework_categories")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data?.id) return { success: false, error: "Insert failed" };

  await writeFrameworkAudit(supabase, {
    schoolId,
    action: "category.create",
    entityType: "framework_category",
    entityId: data.id,
    actorAuthUserId: actorId,
    newValues: row,
  });
  return { success: true, id: data.id };
}

export async function archiveFrameworkCategoryAction(
  categoryId: string,
): Promise<FrameworkActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_framework.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("assessment_framework_categories")
    .update({ archived_at: now, updated_at: now })
    .eq("id", categoryId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };

  await writeFrameworkAudit(supabase, {
    schoolId,
    action: "category.archive",
    entityType: "framework_category",
    entityId: categoryId,
    actorAuthUserId: actorId,
  });
  return { success: true, id: categoryId };
}

export async function reorderFrameworkCategoriesAction(
  frameworkId: string,
  orderedIds: string[],
): Promise<FrameworkActionResult> {
  if (!orderedIds.length) {
    return { success: false, error: "No categories to reorder" };
  }

  const context = await getAuthenticatedSchoolContext(
    "assessment_framework.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertFrameworkOwned(supabase, schoolId, frameworkId);
  if (!owned.ok) return { success: false, error: "Framework not found" };

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("assessment_framework_categories")
      .update({ display_order: i, updated_at: new Date().toISOString() })
      .eq("id", orderedIds[i])
      .eq("framework_id", frameworkId)
      .eq("school_id", schoolId);
    if (error) return { success: false, error: error.message };
  }

  return { success: true, id: frameworkId };
}
