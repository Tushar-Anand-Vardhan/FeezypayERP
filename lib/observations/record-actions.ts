"use server";

import { revalidatePath } from "next/cache";
import {
  assertEmploymentOwned,
  assertStudentInSchool,
  assertSubjectOwned,
  assertTermInYear,
  assertYearOwned,
  getActorId,
  loadObservation,
  resolveCategory,
  resolvePlacement,
  writeObservationAudit,
} from "@/lib/observations/server-helpers";
import type {
  ObservationActionResult,
  RecordObservationInput,
  SetObservationVisibilityInput,
  SupersedeObservationInput,
} from "@/lib/observations/types";
import {
  validateRecordObservationInput,
  validateSetVisibilityInput,
  validateSupersedeObservationInput,
  visibilityFlags,
} from "@/lib/observations/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/observations");
  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/student");
}

export async function recordStudentObservationAction(
  input: RecordObservationInput,
): Promise<ObservationActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "student_observation.record",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateRecordObservationInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }
  if (
    !(await assertStudentInSchool(supabase, schoolId, input.studentProfileId))
  ) {
    return { success: false, error: "Student not found in this school." };
  }
  if (
    input.termId &&
    !(await assertTermInYear(supabase, input.academicYearId, input.termId))
  ) {
    return { success: false, error: "Term not found in year." };
  }
  if (
    input.subjectId &&
    !(await assertSubjectOwned(supabase, schoolId, input.subjectId))
  ) {
    return { success: false, error: "Subject not found." };
  }
  if (
    input.employmentId &&
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const category = await resolveCategory(supabase, schoolId, {
    categoryId: input.categoryId,
    categoryCode: input.categoryCode,
  });
  if (!category) {
    return {
      success: false,
      error: "Category not found. Seed system categories first.",
    };
  }

  const placement = await resolvePlacement(
    supabase,
    schoolId,
    input.studentProfileId,
    input.academicYearId,
  );

  const visibility = input.visibility ?? "staff";
  const vis = visibilityFlags(visibility);

  const { data: row, error } = await supabase
    .from("student_observations")
    .insert({
      school_id: schoolId,
      student_profile_id: input.studentProfileId,
      academic_year_id: input.academicYearId,
      term_id: input.termId ?? null,
      subject_id: input.subjectId ?? null,
      category_id: category.id,
      category_code: category.code,
      observed_on: input.observedOn.trim(),
      remark: input.remark.trim(),
      visibility,
      ...vis,
      recorded_by: actorId,
      recorded_by_employment_id: input.employmentId ?? null,
      class_id: input.classId ?? placement?.classId ?? null,
      section_id: input.sectionId ?? placement?.sectionId ?? null,
      student_academic_year_id: placement?.studentAcademicYearId ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error || !row) {
    return {
      success: false,
      error: error?.message ?? "Failed to record observation.",
    };
  }

  await writeObservationAudit(supabase, {
    schoolId,
    action: "observation.recorded",
    actorId,
    observationId: row.id,
    categoryId: category.id,
    studentProfileId: input.studentProfileId,
    newValues: {
      category_code: category.code,
      observed_on: input.observedOn,
      visibility,
    },
  });

  revalidate();
  return {
    success: true,
    message: "Observation recorded.",
    id: row.id,
  };
}

/**
 * Corrections never overwrite: soft-archive prior + insert new row with supersedes_id.
 */
export async function supersedeStudentObservationAction(
  input: SupersedeObservationInput,
): Promise<ObservationActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "student_observation.record",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateSupersedeObservationInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const prior = await loadObservation(supabase, schoolId, input.observationId);
  if (!prior || prior.archived_at) {
    return { success: false, error: "Observation not found." };
  }

  const category = await resolveCategory(supabase, schoolId, {
    categoryId: input.categoryId ?? (prior.category_id as string),
    categoryCode: input.categoryCode,
  });
  if (!category) {
    return { success: false, error: "Category not found." };
  }

  if (
    input.employmentId &&
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const visibility =
    input.visibility ?? (prior.visibility as typeof input.visibility) ?? "staff";
  const vis = visibilityFlags(visibility);
  const now = new Date().toISOString();

  const { data: next, error } = await supabase
    .from("student_observations")
    .insert({
      school_id: schoolId,
      student_profile_id: prior.student_profile_id,
      academic_year_id: prior.academic_year_id,
      term_id:
        input.termId !== undefined ? input.termId : prior.term_id,
      subject_id:
        input.subjectId !== undefined ? input.subjectId : prior.subject_id,
      category_id: category.id,
      category_code: category.code,
      observed_on: (input.observedOn ?? prior.observed_on) as string,
      remark: input.remark.trim(),
      visibility,
      ...vis,
      recorded_by: actorId,
      recorded_by_employment_id:
        input.employmentId ?? prior.recorded_by_employment_id ?? null,
      class_id: prior.class_id,
      section_id: prior.section_id,
      student_academic_year_id: prior.student_academic_year_id,
      supersedes_id: prior.id,
    })
    .select("id")
    .maybeSingle();

  if (error || !next) {
    return {
      success: false,
      error: error?.message ?? "Failed to supersede observation.",
    };
  }

  await supabase
    .from("student_observations")
    .update({ archived_at: now, archived_by: actorId })
    .eq("id", prior.id);

  await writeObservationAudit(supabase, {
    schoolId,
    action: "observation.superseded",
    actorId,
    observationId: next.id,
    studentProfileId: prior.student_profile_id as string,
    oldValues: { prior_id: prior.id },
    newValues: { id: next.id },
  });

  revalidate();
  return {
    success: true,
    message: "Observation superseded with a new immutable row.",
    id: next.id,
    ids: [prior.id as string, next.id],
  };
}

export async function archiveStudentObservationAction(
  observationId: string,
): Promise<ObservationActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "student_observation.archive",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const row = await loadObservation(supabase, schoolId, observationId);
  if (!row || row.archived_at) {
    return { success: false, error: "Observation not found." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("student_observations")
    .update({ archived_at: now, archived_by: actorId })
    .eq("id", observationId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeObservationAudit(supabase, {
    schoolId,
    action: "observation.archived",
    actorId,
    observationId,
    studentProfileId: row.student_profile_id as string,
  });

  revalidate();
  return { success: true, message: "Observation archived.", id: observationId };
}

/** Visibility metadata only — remark body remains untouched. */
export async function setObservationVisibilityAction(
  input: SetObservationVisibilityInput,
): Promise<ObservationActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "student_observation.record",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateSetVisibilityInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const row = await loadObservation(supabase, schoolId, input.observationId);
  if (!row || row.archived_at) {
    return { success: false, error: "Observation not found." };
  }

  const vis = visibilityFlags(input.visibility);
  const { error } = await supabase
    .from("student_observations")
    .update({
      visibility: input.visibility,
      ...vis,
    })
    .eq("id", input.observationId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeObservationAudit(supabase, {
    schoolId,
    action: "observation.visibility_set",
    actorId,
    observationId: input.observationId,
    studentProfileId: row.student_profile_id as string,
    oldValues: { visibility: row.visibility },
    newValues: { visibility: input.visibility },
  });

  revalidate();
  return {
    success: true,
    message: "Visibility updated (remark unchanged).",
    id: input.observationId,
  };
}
