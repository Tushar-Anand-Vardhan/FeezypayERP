"use server";

import { writeFrameworkAudit } from "@/lib/assessment-framework/audit";
import { ensureCategoryCode } from "@/lib/assessment-framework/codes";
import {
  assertFrameworkOwned,
  getActorId,
} from "@/lib/assessment-framework/server-helpers";
import type {
  FrameworkActionResult,
  FrameworkFormulaInput,
} from "@/lib/assessment-framework/types";
import { validateFormulaInput } from "@/lib/assessment-framework/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function upsertFrameworkFormulaAction(
  input: FrameworkFormulaInput & { id?: string },
): Promise<FrameworkActionResult> {
  const fieldErrors = validateFormulaInput(input, Boolean(input.parts?.length));
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
    description: input.description?.trim() || null,
    term_id: input.termId ?? null,
    formula_kind: input.formulaKind ?? "weighted_sum",
    expression: input.expression ?? {},
    is_final_grade: input.isFinalGrade ?? false,
    display_order: input.displayOrder ?? 0,
    updated_at: new Date().toISOString(),
  };

  let formulaId = input.id;

  if (formulaId) {
    const { error } = await supabase
      .from("assessment_framework_formulas")
      .update(row)
      .eq("id", formulaId)
      .eq("school_id", schoolId);
    if (error) return { success: false, error: error.message };
  } else {
    const { data, error } = await supabase
      .from("assessment_framework_formulas")
      .insert(row)
      .select("id")
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data?.id) return { success: false, error: "Insert failed" };
    formulaId = data.id;
  }

  if (input.parts) {
    const now = new Date().toISOString();
    await supabase
      .from("assessment_framework_formula_parts")
      .update({ archived_at: now })
      .eq("formula_id", formulaId)
      .eq("school_id", schoolId)
      .is("archived_at", null);

    for (let i = 0; i < input.parts.length; i++) {
      const part = input.parts[i];
      const { error } = await supabase
        .from("assessment_framework_formula_parts")
        .insert({
          school_id: schoolId,
          framework_id: input.frameworkId,
          formula_id: formulaId,
          category_id: part.categoryId,
          weight_percent: part.weightPercent,
          display_order: part.displayOrder ?? i,
        });
      if (error) return { success: false, error: error.message };
    }
  }

  await writeFrameworkAudit(supabase, {
    schoolId,
    action: input.id ? "formula.update" : "formula.create",
    entityType: "framework_formula",
    entityId: formulaId,
    actorAuthUserId: actorId,
    newValues: { ...row, parts: input.parts },
  });

  return { success: true, id: formulaId };
}

export async function archiveFrameworkFormulaAction(
  formulaId: string,
): Promise<FrameworkActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_framework.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("assessment_framework_formulas")
    .update({ archived_at: now, updated_at: now })
    .eq("id", formulaId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };

  await supabase
    .from("assessment_framework_formula_parts")
    .update({ archived_at: now })
    .eq("formula_id", formulaId)
    .eq("school_id", schoolId)
    .is("archived_at", null);

  await writeFrameworkAudit(supabase, {
    schoolId,
    action: "formula.archive",
    entityType: "framework_formula",
    entityId: formulaId,
    actorAuthUserId: actorId,
  });
  return { success: true, id: formulaId };
}
