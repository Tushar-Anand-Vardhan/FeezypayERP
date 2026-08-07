"use server";

import {
  assertYearOwned,
  loadObservation,
} from "@/lib/observations/server-helpers";
import type { ListObservationsFilter } from "@/lib/observations/types";
import { validateListFilter } from "@/lib/observations/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listStudentObservationsAction(
  input: ListObservationsFilter,
): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string; fieldErrors?: Record<string, string> }
> {
  const context = await getAuthenticatedSchoolContext(
    "student_observation.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateListFilter(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  let query = supabase
    .from("student_observations")
    .select(
      "id, student_profile_id, academic_year_id, term_id, subject_id, category_id, category_code, observed_on, remark, visibility, visible_to_guardians, visible_to_students, recorded_by, recorded_by_employment_id, class_id, section_id, supersedes_id, archived_at, created_at",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .order("observed_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.min(input.limit ?? 200, 500));

  if (!input.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (input.studentProfileId) {
    query = query.eq("student_profile_id", input.studentProfileId);
  }
  if (input.termId) {
    query = query.eq("term_id", input.termId);
  }
  if (input.subjectId) {
    query = query.eq("subject_id", input.subjectId);
  }
  if (input.categoryCode) {
    query = query.eq("category_code", input.categoryCode);
  }
  if (input.categoryId) {
    query = query.eq("category_id", input.categoryId);
  }
  if (input.employmentId) {
    query = query.eq("recorded_by_employment_id", input.employmentId);
  }
  if (input.visibility) {
    query = query.eq("visibility", input.visibility);
  }
  if (input.classId) {
    query = query.eq("class_id", input.classId);
  }
  if (input.sectionId) {
    query = query.eq("section_id", input.sectionId);
  }
  if (input.observedOnFrom) {
    query = query.gte("observed_on", input.observedOnFrom);
  }
  if (input.observedOnTo) {
    query = query.lte("observed_on", input.observedOnTo);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function getStudentObservationAction(
  observationId: string,
): Promise<
  | { success: true; observation: Record<string, unknown> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "student_observation.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const row = await loadObservation(supabase, schoolId, observationId);
  if (!row) {
    return { success: false, error: "Observation not found." };
  }
  return { success: true, observation: row };
}

export async function listObservationAuditAction(input?: {
  studentProfileId?: string;
  limit?: number;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "student_observation.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("student_observation_audit_log")
    .select(
      "id, action, actor_id, observation_id, category_id, student_profile_id, old_values, new_values, created_at",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(Math.min(input?.limit ?? 100, 500));

  if (input?.studentProfileId) {
    query = query.eq("student_profile_id", input.studentProfileId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}
