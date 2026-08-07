"use server";

import { revalidatePath } from "next/cache";
import {
  assertGridOwned,
  assertYearOwned,
  getActorId,
} from "@/lib/timetable/server-helpers";
import type {
  CycleDayInput,
  GridInput,
  TimetableActionResult,
} from "@/lib/timetable/types";
import {
  validateCycleDayInput,
  validateGridInput,
} from "@/lib/timetable/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/timetable");
  revalidatePath("/onboarding", "layout");
}

const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export async function listTimetableGridsAction(
  academicYearId: string,
): Promise<
  | {
      success: true;
      grids: Array<{
        id: string;
        name: string;
        grid_type: string;
        cycle_length: number;
        is_active: boolean;
        effective_from: string | null;
        effective_to: string | null;
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
  if (!(await assertYearOwned(supabase, schoolId, academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  const { data, error } = await supabase
    .from("timetable_grids")
    .select(
      "id, name, grid_type, cycle_length, is_active, effective_from, effective_to, archived_at",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, grids: data ?? [] };
}

export async function createTimetableGridAction(
  input: GridInput,
): Promise<TimetableActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateGridInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const academicYearId = input.academicYearId.trim();
  if (!(await assertYearOwned(supabase, schoolId, academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  const actorId = await getActorId(supabase);
  const gridType = input.gridType ?? "alternate";
  const cycleLength = input.cycleLength ?? 6;
  const isActive = input.isActive ?? false;

  if (isActive && gridType === "primary") {
    await supabase
      .from("timetable_grids")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("academic_year_id", academicYearId)
      .eq("grid_type", "primary")
      .eq("is_active", true);
  }

  const { data, error } = await supabase
    .from("timetable_grids")
    .insert({
      school_id: schoolId,
      academic_year_id: academicYearId,
      name: input.name.trim(),
      grid_type: gridType,
      cycle_length: cycleLength,
      is_active: isActive,
      effective_from: input.effectiveFrom || null,
      effective_to: input.effectiveTo || null,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create grid.",
    };
  }

  const cycleRows = Array.from({ length: cycleLength }, (_, i) => {
    const dayIndex = i + 1;
    const mapsToWeekday = dayIndex <= 7 ? dayIndex : null;
    return {
      grid_id: data.id,
      day_index: dayIndex,
      label:
        mapsToWeekday != null
          ? WEEKDAY_LABELS[mapsToWeekday - 1]
          : `Day ${dayIndex}`,
      maps_to_weekday: mapsToWeekday,
    };
  });

  await supabase.from("timetable_cycle_days").insert(cycleRows);

  revalidate();
  return { success: true, message: "Timetable grid created.", id: data.id };
}

export async function activateTimetableGridAction(
  gridId: string,
): Promise<TimetableActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertGridOwned(supabase, schoolId, gridId))) {
    return { success: false, error: "Grid not found." };
  }

  const { data: grid } = await supabase
    .from("timetable_grids")
    .select("id, academic_year_id, grid_type")
    .eq("id", gridId)
    .maybeSingle();

  if (!grid) {
    return { success: false, error: "Grid not found." };
  }

  const actorId = await getActorId(supabase);

  if (grid.grid_type === "primary") {
    await supabase
      .from("timetable_grids")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("academic_year_id", grid.academic_year_id)
      .eq("grid_type", "primary")
      .neq("id", gridId);
  }

  const { error } = await supabase
    .from("timetable_grids")
    .update({
      is_active: true,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gridId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Grid activated.", id: gridId };
}

export async function archiveTimetableGridAction(
  gridId: string,
): Promise<TimetableActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertGridOwned(supabase, schoolId, gridId))) {
    return { success: false, error: "Grid not found." };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("timetable_grids")
    .update({
      is_active: false,
      archived_at: new Date().toISOString(),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gridId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Grid archived.", id: gridId };
}

export async function listCycleDaysAction(
  gridId: string,
): Promise<
  | {
      success: true;
      days: Array<{
        id: string;
        day_index: number;
        label: string;
        maps_to_weekday: number | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertGridOwned(supabase, schoolId, gridId))) {
    return { success: false, error: "Grid not found." };
  }

  const { data, error } = await supabase
    .from("timetable_cycle_days")
    .select("id, day_index, label, maps_to_weekday")
    .eq("grid_id", gridId)
    .order("day_index");

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, days: data ?? [] };
}

export async function upsertCycleDayAction(
  input: CycleDayInput & { id?: string },
): Promise<TimetableActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateCycleDayInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (!(await assertGridOwned(supabase, schoolId, input.gridId))) {
    return { success: false, error: "Grid not found." };
  }

  if (input.id) {
    const { error } = await supabase
      .from("timetable_cycle_days")
      .update({
        day_index: input.dayIndex,
        label: input.label.trim(),
        maps_to_weekday: input.mapsToWeekday ?? null,
      })
      .eq("id", input.id)
      .eq("grid_id", input.gridId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidate();
    return { success: true, message: "Cycle day updated.", id: input.id };
  }

  const { data, error } = await supabase
    .from("timetable_cycle_days")
    .insert({
      grid_id: input.gridId,
      day_index: input.dayIndex,
      label: input.label.trim(),
      maps_to_weekday: input.mapsToWeekday ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create cycle day.",
    };
  }

  revalidate();
  return { success: true, message: "Cycle day created.", id: data.id };
}
