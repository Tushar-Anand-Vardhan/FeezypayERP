"use server";

import { revalidatePath } from "next/cache";
import {
  assertEmploymentOwned,
  assertSectionInSchool,
  assertYearOwned,
  getActorId,
} from "@/lib/timetable/server-helpers";
import type {
  SectionAvailabilityInput,
  TeacherAvailabilityInput,
  TimetableActionResult,
} from "@/lib/timetable/types";
import {
  validateSectionAvailabilityInput,
  validateTeacherAvailabilityInput,
} from "@/lib/timetable/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/timetable");
}

export async function upsertTeacherAvailabilityAction(
  input: TeacherAvailabilityInput,
): Promise<TimetableActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateTeacherAvailabilityInput(input);
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
  if (
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const actorId = await getActorId(supabase);
  const periodId = input.periodDefinitionId?.trim() || null;

  let existingQuery = supabase
    .from("teacher_availability")
    .select("id")
    .eq("employment_id", input.employmentId)
    .eq("day_of_week", input.dayOfWeek)
    .is("archived_at", null);

  existingQuery = periodId
    ? existingQuery.eq("period_definition_id", periodId)
    : existingQuery.is("period_definition_id", null);

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("teacher_availability")
      .update({
        is_available: input.isAvailable,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidate();
    return {
      success: true,
      message: "Teacher availability updated.",
      id: existing.id,
    };
  }

  const { data, error } = await supabase
    .from("teacher_availability")
    .insert({
      school_id: schoolId,
      academic_year_id: input.academicYearId,
      employment_id: input.employmentId,
      day_of_week: input.dayOfWeek,
      period_definition_id: periodId,
      is_available: input.isAvailable,
      notes: input.notes?.trim() || null,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not save availability.",
    };
  }

  revalidate();
  return {
    success: true,
    message: "Teacher availability saved.",
    id: data.id,
  };
}

export async function upsertSectionAvailabilityAction(
  input: SectionAvailabilityInput,
): Promise<TimetableActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateSectionAvailabilityInput(input);
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
  if (!(await assertSectionInSchool(supabase, schoolId, input.sectionId))) {
    return { success: false, error: "Section not found." };
  }

  const actorId = await getActorId(supabase);
  const periodId = input.periodDefinitionId?.trim() || null;

  let existingQuery = supabase
    .from("section_availability")
    .select("id")
    .eq("section_id", input.sectionId)
    .eq("day_of_week", input.dayOfWeek)
    .is("archived_at", null);

  existingQuery = periodId
    ? existingQuery.eq("period_definition_id", periodId)
    : existingQuery.is("period_definition_id", null);

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("section_availability")
      .update({
        is_available: input.isAvailable,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidate();
    return {
      success: true,
      message: "Section availability updated.",
      id: existing.id,
    };
  }

  const { data, error } = await supabase
    .from("section_availability")
    .insert({
      school_id: schoolId,
      academic_year_id: input.academicYearId,
      section_id: input.sectionId,
      day_of_week: input.dayOfWeek,
      period_definition_id: periodId,
      is_available: input.isAvailable,
      notes: input.notes?.trim() || null,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not save availability.",
    };
  }

  revalidate();
  return {
    success: true,
    message: "Section availability saved.",
    id: data.id,
  };
}

export async function listTeacherAvailabilityAction(
  employmentId: string,
  academicYearId: string,
): Promise<
  | {
      success: true;
      rows: Array<{
        id: string;
        day_of_week: number;
        period_definition_id: string | null;
        is_available: boolean;
        notes: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertEmploymentOwned(supabase, schoolId, employmentId))) {
    return { success: false, error: "Employment not found." };
  }

  const { data, error } = await supabase
    .from("teacher_availability")
    .select("id, day_of_week, period_definition_id, is_available, notes")
    .eq("employment_id", employmentId)
    .eq("academic_year_id", academicYearId)
    .is("archived_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, rows: data ?? [] };
}
