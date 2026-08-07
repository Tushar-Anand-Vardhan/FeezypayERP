"use server";

import { writeGradeCalcAudit } from "@/lib/grade-calculation/audit";
import { getActorId } from "@/lib/grade-calculation/server-helpers";
import type {
  ExemptionInput,
  GraceRuleInput,
  GradeActionResult,
  OptionalSubjectInput,
} from "@/lib/grade-calculation/types";
import {
  validateExemptionInput,
  validateGraceRuleInput,
  validateOptionalSubjectInput,
} from "@/lib/grade-calculation/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import { slugCode } from "@/lib/curriculum/codes";

export async function upsertGraceRuleAction(
  input: GraceRuleInput & { id?: string },
): Promise<GradeActionResult> {
  const fieldErrors = validateGraceRuleInput(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext(
    "grade_calculation.configure",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const row = {
    school_id: schoolId,
    academic_year_id: input.academicYearId ?? null,
    code: slugCode(input.name, input.code ?? "GRACE"),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    rules: input.rules,
    status: "published",
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("grade_calculation_grace_rules")
      .update(row)
      .eq("id", input.id)
      .eq("school_id", schoolId);
    if (error) return { success: false, error: error.message };
    return { success: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("grade_calculation_grace_rules")
    .insert({ ...row, created_by: actorId })
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };

  await writeGradeCalcAudit(supabase, {
    schoolId,
    action: "grace.create",
    entityType: "grace_rule",
    entityId: data?.id,
    actorAuthUserId: actorId,
    newValues: row,
  });
  return { success: true, id: data?.id };
}

export async function upsertOptionalSubjectAction(
  input: OptionalSubjectInput & { id?: string },
): Promise<GradeActionResult> {
  const fieldErrors = validateOptionalSubjectInput(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext(
    "grade_calculation.configure",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const row = {
    school_id: schoolId,
    academic_year_id: input.academicYearId,
    class_id: input.classId,
    subject_id: input.subjectId,
    include_in_overall: input.includeInOverall ?? false,
    weight_override_percent: input.weightOverridePercent ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("grade_calculation_optional_subjects")
      .update(row)
      .eq("id", input.id)
      .eq("school_id", schoolId);
    if (error) return { success: false, error: error.message };
    return { success: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("grade_calculation_optional_subjects")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  return { success: true, id: data?.id };
}

export async function createExemptionAction(
  input: ExemptionInput,
): Promise<GradeActionResult> {
  const fieldErrors = validateExemptionInput(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext(
    "grade_calculation.configure",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data, error } = await supabase
    .from("grade_calculation_exemptions")
    .insert({
      school_id: schoolId,
      academic_year_id: input.academicYearId,
      student_profile_id: input.studentProfileId,
      subject_id: input.subjectId ?? null,
      framework_category_id: input.frameworkCategoryId ?? null,
      assessment_record_id: input.assessmentRecordId ?? null,
      exemption_kind: input.exemptionKind,
      reason: input.reason?.trim() || null,
      granted_by: actorId,
    })
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };

  await writeGradeCalcAudit(supabase, {
    schoolId,
    action: "exemption.create",
    entityType: "exemption",
    entityId: data?.id,
    actorAuthUserId: actorId,
  });
  return { success: true, id: data?.id };
}

export async function archiveExemptionAction(
  exemptionId: string,
): Promise<GradeActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "grade_calculation.configure",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const { error } = await supabase
    .from("grade_calculation_exemptions")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", exemptionId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };
  return { success: true, id: exemptionId };
}
