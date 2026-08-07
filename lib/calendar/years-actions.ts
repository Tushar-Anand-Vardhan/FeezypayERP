"use server";

import { revalidatePath } from "next/cache";
import type {
  AcademicYearStatus,
  CalendarActionResult,
} from "@/lib/calendar/types";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listAcademicYearsAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | {
      success: true;
      years: Array<{
        id: string;
        label: string;
        is_active: boolean;
        status: AcademicYearStatus;
        start_date: string | null;
        end_date: string | null;
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
    .from("academic_years")
    .select(
      "id, label, is_active, status, start_date, end_date, archived_at",
    )
    .eq("school_id", schoolId)
    .order("label", { ascending: false });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    years: (data ?? []).map((row) => ({
      ...row,
      status: row.status as AcademicYearStatus,
    })),
  };
}

export async function createAcademicYearAction(input: {
  label: string;
  startDate?: string | null;
  endDate?: string | null;
  activate?: boolean;
}): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const label = input.label.trim();
  if (!label) {
    return {
      success: false,
      error: "Label is required.",
      fieldErrors: { label: "Label is required." },
    };
  }

  const { supabase, schoolId } = context;
  const activate = input.activate ?? false;

  if (activate) {
    await supabase
      .from("academic_years")
      .update({
        is_active: false,
        status: "closed",
        updated_at: new Date().toISOString(),
      })
      .eq("school_id", schoolId)
      .eq("is_active", true);
  }

  const { data, error } = await supabase
    .from("academic_years")
    .insert({
      school_id: schoolId,
      label,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      is_active: activate,
      status: activate ? "active" : "draft",
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create academic year.",
    };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Academic year created.", id: data.id };
}

export async function activateAcademicYearAction(
  yearId: string,
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  await supabase
    .from("academic_years")
    .update({
      is_active: false,
      status: "closed",
      updated_at: new Date().toISOString(),
    })
    .eq("school_id", schoolId)
    .neq("id", yearId)
    .is("archived_at", null);

  const { error } = await supabase
    .from("academic_years")
    .update({
      is_active: true,
      status: "active",
      archived_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", yearId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Academic year activated.", id: yearId };
}

export async function closeAcademicYearAction(
  yearId: string,
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { error } = await supabase
    .from("academic_years")
    .update({
      is_active: false,
      status: "closed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", yearId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Academic year closed.", id: yearId };
}

export async function archiveAcademicYearAction(
  yearId: string,
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { error } = await supabase
    .from("academic_years")
    .update({
      is_active: false,
      status: "closed",
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", yearId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Academic year archived.", id: yearId };
}
