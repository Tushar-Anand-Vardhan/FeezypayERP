"use server";

import { revalidatePath } from "next/cache";
import type { CalendarActionResult, HolidayInput } from "@/lib/calendar/types";
import {
  trimHolidayInput,
  validateHolidayInput,
} from "@/lib/calendar/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

async function actorId(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function listHolidaysAction(
  academicYearId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      holidays: Array<{
        id: string;
        title: string;
        description: string | null;
        start_date: string;
        end_date: string;
        is_all_day: boolean;
        archived_at: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("holidays")
    .select(
      "id, title, description, start_date, end_date, is_all_day, archived_at",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .order("start_date", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, holidays: data ?? [] };
}

export async function createHolidayAction(
  input: HolidayInput,
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimHolidayInput(input);
  const fieldErrors = validateHolidayInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const createdBy = await actorId(supabase);

  const { data: year } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", trimmed.academicYearId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!year) {
    return { success: false, error: "Academic year not found." };
  }

  const { data, error } = await supabase
    .from("holidays")
    .insert({
      school_id: schoolId,
      academic_year_id: trimmed.academicYearId,
      title: trimmed.title,
      description: trimmed.description || null,
      start_date: trimmed.startDate,
      end_date: trimmed.endDate,
      is_all_day: trimmed.isAllDay ?? true,
      created_by: createdBy,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create holiday.",
    };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Holiday created.", id: data.id };
}

export async function updateHolidayAction(
  input: HolidayInput & { id: string },
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimHolidayInput(input);
  const fieldErrors = validateHolidayInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const { error } = await supabase
    .from("holidays")
    .update({
      title: trimmed.title,
      description: trimmed.description || null,
      start_date: trimmed.startDate,
      end_date: trimmed.endDate,
      is_all_day: trimmed.isAllDay ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("school_id", schoolId)
    .is("archived_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Holiday updated.", id: input.id };
}

export async function archiveHolidayAction(
  holidayId: string,
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { error } = await supabase
    .from("holidays")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", holidayId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Holiday archived.", id: holidayId };
}

export async function restoreHolidayAction(
  holidayId: string,
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { error } = await supabase
    .from("holidays")
    .update({
      archived_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", holidayId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Holiday restored.", id: holidayId };
}
