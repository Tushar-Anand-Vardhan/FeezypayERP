"use server";

import { revalidatePath } from "next/cache";
import type { CalendarActionResult, TermInput } from "@/lib/calendar/types";
import { trimTermInput, validateTermInput } from "@/lib/calendar/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

async function assertYearOwned(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  schoolId: string,
  academicYearId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", academicYearId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function listTermsAction(
  academicYearId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      terms: Array<{
        id: string;
        name: string;
        start_date: string;
        end_date: string;
        start_month: number | null;
        start_day: number | null;
        end_month: number | null;
        end_day: number | null;
        archived_at: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("calendar.year.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  let query = supabase
    .from("terms")
    .select(
      "id, name, start_date, end_date, start_month, start_day, end_month, end_day, archived_at",
    )
    .eq("academic_year_id", academicYearId)
    .order("start_date", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, terms: data ?? [] };
}

export async function createTermAction(
  input: TermInput,
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext("calendar.year.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimTermInput(input);
  const fieldErrors = validateTermInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, trimmed.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  const { data, error } = await supabase
    .from("terms")
    .insert({
      academic_year_id: trimmed.academicYearId,
      name: trimmed.name,
      start_date: trimmed.startDate,
      end_date: trimmed.endDate,
      start_month: trimmed.startMonth ?? null,
      start_day: trimmed.startDay ?? null,
      end_month: trimmed.endMonth ?? null,
      end_day: trimmed.endDay ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create term.",
    };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Term created.", id: data.id };
}

export async function updateTermAction(
  input: TermInput & { id: string },
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext("calendar.year.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimTermInput(input);
  const fieldErrors = validateTermInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, trimmed.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  const { error } = await supabase
    .from("terms")
    .update({
      name: trimmed.name,
      start_date: trimmed.startDate,
      end_date: trimmed.endDate,
      start_month: trimmed.startMonth ?? null,
      start_day: trimmed.startDay ?? null,
      end_month: trimmed.endMonth ?? null,
      end_day: trimmed.endDay ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("academic_year_id", trimmed.academicYearId)
    .is("archived_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Term updated.", id: input.id };
}

export async function archiveTermAction(
  termId: string,
  academicYearId: string,
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext("calendar.year.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  const { error } = await supabase
    .from("terms")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", termId)
    .eq("academic_year_id", academicYearId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Term archived.", id: termId };
}

export async function restoreTermAction(
  termId: string,
  academicYearId: string,
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext("calendar.year.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  const { error } = await supabase
    .from("terms")
    .update({
      archived_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", termId)
    .eq("academic_year_id", academicYearId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Term restored.", id: termId };
}
