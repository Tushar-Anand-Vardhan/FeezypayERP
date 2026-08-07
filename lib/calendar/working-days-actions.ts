"use server";

import { revalidatePath } from "next/cache";
import type { CalendarActionResult, WorkingDayPatternInput } from "@/lib/calendar/types";
import { validateWorkingDayPattern } from "@/lib/calendar/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function getWorkingDayPatternAction(
  academicYearId?: string | null,
): Promise<
  | { success: true; pattern: WorkingDayPatternInput & { id: string } }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("calendar.year.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  let query = supabase
    .from("school_working_day_patterns")
    .select(
      "id, academic_year_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday",
    )
    .eq("school_id", schoolId);

  if (academicYearId) {
    query = query.eq("academic_year_id", academicYearId);
  } else {
    query = query.is("academic_year_id", null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    return { success: false, error: error.message };
  }

  if (!data) {
    return {
      success: true,
      pattern: {
        id: "",
        academicYearId: academicYearId ?? null,
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      },
    };
  }

  return {
    success: true,
    pattern: {
      id: data.id,
      academicYearId: data.academic_year_id,
      monday: data.monday,
      tuesday: data.tuesday,
      wednesday: data.wednesday,
      thursday: data.thursday,
      friday: data.friday,
      saturday: data.saturday,
      sunday: data.sunday,
    },
  };
}

export async function upsertWorkingDayPatternAction(
  input: WorkingDayPatternInput,
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext("calendar.year.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateWorkingDayPattern(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const yearId = input.academicYearId || null;

  let existingQuery = supabase
    .from("school_working_day_patterns")
    .select("id")
    .eq("school_id", schoolId);

  existingQuery = yearId
    ? existingQuery.eq("academic_year_id", yearId)
    : existingQuery.is("academic_year_id", null);

  const { data: existing } = await existingQuery.maybeSingle();

  const payload = {
    school_id: schoolId,
    academic_year_id: yearId,
    monday: input.monday,
    tuesday: input.tuesday,
    wednesday: input.wednesday,
    thursday: input.thursday,
    friday: input.friday,
    saturday: input.saturday,
    sunday: input.sunday,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("school_working_day_patterns")
      .update(payload)
      .eq("id", existing.id);
    if (error) {
      return { success: false, error: error.message };
    }
    revalidatePath("/dashboard/calendar");
    return {
      success: true,
      message: "Working days saved.",
      id: existing.id,
    };
  }

  const { data, error } = await supabase
    .from("school_working_day_patterns")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not save working days.",
    };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Working days saved.", id: data.id };
}
