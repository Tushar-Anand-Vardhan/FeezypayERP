"use server";

import { revalidatePath } from "next/cache";
import {
  assertGradingScaleOwned,
  assertYearOwned,
  getActorId,
} from "@/lib/assessment/server-helpers";
import type {
  AssessmentActionResult,
  AssessmentPolicyInput,
} from "@/lib/assessment/types";
import {
  lockRulesToJson,
  publishRulesToJson,
  validateAssessmentPolicyInput,
} from "@/lib/assessment/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/assessments");
  revalidatePath("/onboarding", "layout");
}

export async function getAssessmentPolicyAction(
  academicYearId?: string | null,
): Promise<
  | {
      success: true;
      policy: {
        id: string;
        academic_year_id: string | null;
        default_pass_percent: number;
        default_grading_scale_id: string | null;
        publish_rules: unknown;
        lock_rules: unknown;
        moderation_enabled: boolean;
        ai_evaluation_enabled: boolean;
      } | null;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("assessment.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  if (academicYearId) {
    if (!(await assertYearOwned(supabase, schoolId, academicYearId))) {
      return { success: false, error: "Academic year not found." };
    }
    const { data, error } = await supabase
      .from("assessment_policies")
      .select(
        "id, academic_year_id, default_pass_percent, default_grading_scale_id, publish_rules, lock_rules, moderation_enabled, ai_evaluation_enabled",
      )
      .eq("school_id", schoolId)
      .eq("academic_year_id", academicYearId)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, policy: data };
  }

  const { data, error } = await supabase
    .from("assessment_policies")
    .select(
      "id, academic_year_id, default_pass_percent, default_grading_scale_id, publish_rules, lock_rules, moderation_enabled, ai_evaluation_enabled",
    )
    .eq("school_id", schoolId)
    .is("academic_year_id", null)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, policy: data };
}

export async function upsertAssessmentPolicyAction(
  input: AssessmentPolicyInput,
): Promise<AssessmentActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.config.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateAssessmentPolicyInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const academicYearId = input.academicYearId?.trim() || null;

  if (academicYearId) {
    if (!(await assertYearOwned(supabase, schoolId, academicYearId))) {
      return { success: false, error: "Academic year not found." };
    }
  }

  if (input.defaultGradingScaleId) {
    if (
      !(await assertGradingScaleOwned(
        supabase,
        schoolId,
        input.defaultGradingScaleId,
      ))
    ) {
      return { success: false, error: "Grading scale not found." };
    }
  }

  const actorId = await getActorId(supabase);
  const payload = {
    school_id: schoolId,
    academic_year_id: academicYearId,
    default_pass_percent: input.defaultPassPercent ?? 33,
    default_grading_scale_id: input.defaultGradingScaleId || null,
    publish_rules: publishRulesToJson(input.publishRules),
    lock_rules: lockRulesToJson(input.lockRules),
    moderation_enabled: input.moderationEnabled ?? false,
    ai_evaluation_enabled: input.aiEvaluationEnabled ?? false,
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };

  let existingQuery = supabase
    .from("assessment_policies")
    .select("id")
    .eq("school_id", schoolId);

  existingQuery = academicYearId
    ? existingQuery.eq("academic_year_id", academicYearId)
    : existingQuery.is("academic_year_id", null);

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("assessment_policies")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Could not update policy.",
      };
    }

    revalidate();
    return { success: true, message: "Assessment policy saved.", id: data.id };
  }

  const { data, error } = await supabase
    .from("assessment_policies")
    .insert({ ...payload, created_by: actorId })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create policy.",
    };
  }

  revalidate();
  return { success: true, message: "Assessment policy saved.", id: data.id };
}
