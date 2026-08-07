"use server";

import { revalidatePath } from "next/cache";
import {
  assertYearOwned,
  getActorId,
  loadPeriodsForYear,
} from "@/lib/timetable/server-helpers";
import type { PeriodInput, TimetableActionResult } from "@/lib/timetable/types";
import {
  trimPeriodInput,
  validatePeriodInput,
  validatePeriodSet,
} from "@/lib/timetable/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/timetable");
  revalidatePath("/onboarding", "layout");
}

export async function listPeriodsAction(
  academicYearId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      periods: Array<{
        id: string;
        period_number: number;
        start_time: string;
        end_time: string;
        name: string | null;
        is_break: boolean;
        is_locked: boolean;
        archived_at: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("timetable.grid.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  let query = supabase
    .from("period_definitions")
    .select(
      "id, period_number, start_time, end_time, name, is_break, is_locked, archived_at",
    )
    .eq("academic_year_id", academicYearId)
    .order("period_number");

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    periods: (data ?? []).map((row) => ({
      ...row,
      start_time: String(row.start_time).slice(0, 5),
      end_time: String(row.end_time).slice(0, 5),
    })),
  };
}

export async function upsertPeriodAction(
  input: PeriodInput,
): Promise<TimetableActionResult> {
  const context = await getAuthenticatedSchoolContext("timetable.grid.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimPeriodInput(input);
  const fieldErrors = validatePeriodInput(trimmed);
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

  const existingPeriods = await loadPeriodsForYear(
    supabase,
    trimmed.academicYearId,
  );
  const snapshot = existingPeriods
    .filter((p) => p.id !== trimmed.id)
    .concat([
      {
        id: trimmed.id ?? "new",
        periodNumber: trimmed.periodNumber,
        startTime: trimmed.startTime,
        endTime: trimmed.endTime,
        isBreak: trimmed.isBreak,
        isLocked: false,
      },
    ]);

  const overlaps = validatePeriodSet(snapshot);
  if (overlaps.length > 0) {
    return {
      success: false,
      error: overlaps[0].message,
      conflicts: overlaps,
    };
  }

  if (trimmed.id) {
    const { data: current } = await supabase
      .from("period_definitions")
      .select("is_locked")
      .eq("id", trimmed.id)
      .maybeSingle();

    if (current?.is_locked) {
      return {
        success: false,
        error: "Period is locked.",
        conflicts: [
          {
            kind: "period_locked",
            message: "Period is locked.",
          },
        ],
      };
    }

    const { error } = await supabase
      .from("period_definitions")
      .update({
        period_number: trimmed.periodNumber,
        start_time: trimmed.startTime,
        end_time: trimmed.endTime,
        name: trimmed.name || null,
        is_break: trimmed.isBreak ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", trimmed.id)
      .eq("academic_year_id", trimmed.academicYearId)
      .is("archived_at", null);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidate();
    return { success: true, message: "Period updated.", id: trimmed.id };
  }

  const { data, error } = await supabase
    .from("period_definitions")
    .insert({
      academic_year_id: trimmed.academicYearId,
      period_number: trimmed.periodNumber,
      start_time: trimmed.startTime,
      end_time: trimmed.endTime,
      name: trimmed.name || null,
      is_break: trimmed.isBreak ?? false,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create period.",
    };
  }

  revalidate();
  return { success: true, message: "Period created.", id: data.id };
}

export async function setPeriodLockAction(
  periodId: string,
  locked: boolean,
): Promise<TimetableActionResult> {
  const context = await getAuthenticatedSchoolContext("timetable.grid.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const { data: period } = await supabase
    .from("period_definitions")
    .select("id, academic_year_id, academic_years!inner(school_id)")
    .eq("id", periodId)
    .eq("academic_years.school_id", schoolId)
    .maybeSingle();

  if (!period) {
    return { success: false, error: "Period not found." };
  }

  const { error } = await supabase
    .from("period_definitions")
    .update({
      is_locked: locked,
      locked_at: locked ? new Date().toISOString() : null,
      locked_by: locked ? actorId : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", periodId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return {
    success: true,
    message: locked ? "Period locked." : "Period unlocked.",
    id: periodId,
  };
}

export async function archivePeriodAction(
  periodId: string,
): Promise<TimetableActionResult> {
  const context = await getAuthenticatedSchoolContext("timetable.grid.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: period } = await supabase
    .from("period_definitions")
    .select("id, is_locked, academic_years!inner(school_id)")
    .eq("id", periodId)
    .eq("academic_years.school_id", schoolId)
    .maybeSingle();

  if (!period) {
    return { success: false, error: "Period not found." };
  }
  if (period.is_locked) {
    return { success: false, error: "Unlock the period before archiving." };
  }

  const { error } = await supabase
    .from("period_definitions")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", periodId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Period archived.", id: periodId };
}
