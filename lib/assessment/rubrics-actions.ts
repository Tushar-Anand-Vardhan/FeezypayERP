"use server";

import { revalidatePath } from "next/cache";
import {
  ensureRubricCode,
  validateRubricInput,
  type AssessmentActionResult,
  type RubricInput,
} from "@/lib/assessment/rubrics";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/assessments");
  revalidatePath("/dashboard/grading-scales");
}

export async function listAssessmentRubricsAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | {
      success: true;
      rubrics: Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        max_score: number | null;
        archived_at: string | null;
        criteria: Array<{
          id: string;
          name: string;
          description: string | null;
          max_score: number;
          weight: number;
          display_order: number;
          levels: unknown;
        }>;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("assessment.config.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("assessment_rubrics")
    .select(
      "id, code, name, description, max_score, archived_at, assessment_rubric_criteria(id, name, description, max_score, weight, display_order, levels, archived_at)",
    )
    .eq("school_id", schoolId)
    .order("name");

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  const rubrics = (data ?? []).map((row) => {
    const criteriaRaw = Array.isArray(row.assessment_rubric_criteria)
      ? row.assessment_rubric_criteria
      : row.assessment_rubric_criteria
        ? [row.assessment_rubric_criteria]
        : [];
    const criteria = (criteriaRaw as Array<Record<string, unknown>>)
      .filter((c) => !c.archived_at)
      .sort(
        (a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0),
      )
      .map((c) => ({
        id: String(c.id),
        name: String(c.name),
        description: (c.description as string | null) ?? null,
        max_score: Number(c.max_score ?? 1),
        weight: Number(c.weight ?? 1),
        display_order: Number(c.display_order ?? 0),
        levels: c.levels ?? [],
      }));
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      max_score: row.max_score,
      archived_at: row.archived_at,
      criteria,
    };
  });

  return { success: true, rubrics };
}

export async function upsertAssessmentRubricAction(
  input: RubricInput,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateRubricInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const code = ensureRubricCode(input.name, input.code);
  const now = new Date().toISOString();

  let rubricId = input.id;

  if (rubricId) {
    const { data: owned } = await supabase
      .from("assessment_rubrics")
      .select("id")
      .eq("id", rubricId)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .maybeSingle();
    if (!owned) {
      return { success: false, error: "Rubric not found." };
    }
    const { error } = await supabase
      .from("assessment_rubrics")
      .update({
        code,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        max_score: input.maxScore ?? null,
        updated_at: now,
      })
      .eq("id", rubricId);
    if (error) {
      return { success: false, error: error.message };
    }
  } else {
    const { data, error } = await supabase
      .from("assessment_rubrics")
      .insert({
        school_id: schoolId,
        code,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        max_score: input.maxScore ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Could not create rubric.",
      };
    }
    rubricId = data.id;
  }

  // Replace active criteria set when provided
  if (input.criteria) {
    const { data: existing } = await supabase
      .from("assessment_rubric_criteria")
      .select("id")
      .eq("rubric_id", rubricId)
      .is("archived_at", null);
    const keep = new Set(
      input.criteria.map((c) => c.id).filter(Boolean) as string[],
    );
    for (const row of existing ?? []) {
      if (!keep.has(row.id)) {
        await supabase
          .from("assessment_rubric_criteria")
          .update({ archived_at: now, updated_at: now })
          .eq("id", row.id);
      }
    }

    for (const [index, c] of input.criteria.entries()) {
      const payload = {
        rubric_id: rubricId,
        name: c.name.trim(),
        description: c.description?.trim() || null,
        max_score: c.maxScore ?? 1,
        weight: c.weight ?? 1,
        display_order: c.displayOrder ?? index,
        levels: c.levels ?? [],
        updated_at: now,
        archived_at: null,
      };
      if (c.id) {
        const { error } = await supabase
          .from("assessment_rubric_criteria")
          .update(payload)
          .eq("id", c.id)
          .eq("rubric_id", rubricId);
        if (error) {
          return { success: false, error: error.message };
        }
      } else {
        const { error } = await supabase
          .from("assessment_rubric_criteria")
          .insert(payload);
        if (error) {
          return { success: false, error: error.message };
        }
      }
    }
  }

  revalidate();
  return {
    success: true,
    message: input.id ? "Rubric updated." : "Rubric created.",
    id: rubricId,
  };
}

export async function archiveAssessmentRubricAction(
  rubricId: string,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }
  const { supabase, schoolId } = context;
  const { error } = await supabase
    .from("assessment_rubrics")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", rubricId)
    .eq("school_id", schoolId);
  if (error) {
    return { success: false, error: error.message };
  }
  revalidate();
  return { success: true, message: "Rubric archived.", id: rubricId };
}
