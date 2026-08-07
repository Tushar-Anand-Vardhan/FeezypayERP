"use server";

import { revalidatePath } from "next/cache";
import {
  assertEmploymentOwned,
  assertGridOwned,
  assertSectionInSchool,
  assertYearOwned,
  getActorId,
  loadExistingSlotsForConflict,
  loadPeriodsForYear,
  loadSectionBlocks,
  loadTeacherBlocks,
} from "@/lib/timetable/server-helpers";
import type { SlotInput, TimetableActionResult } from "@/lib/timetable/types";
import {
  detectSlotConflicts,
  validateSlotInput,
} from "@/lib/timetable/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/timetable");
  revalidatePath("/onboarding", "layout");
}

async function academicYearForSection(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  sectionId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("sections")
    .select("classes!inner(academic_year_id)")
    .eq("id", sectionId)
    .maybeSingle();

  const classes = data?.classes as
    | { academic_year_id?: string }
    | { academic_year_id?: string }[]
    | null;
  const row = Array.isArray(classes) ? classes[0] : classes;
  return row?.academic_year_id ?? null;
}

export async function listTimetableSlotsAction(input: {
  academicYearId: string;
  gridId?: string | null;
  sectionId?: string;
}): Promise<
  | {
      success: true;
      slots: Array<{
        id: string;
        grid_id: string | null;
        section_id: string;
        day_of_week: number;
        period_definition_id: string;
        subject_id: string | null;
        teacher_id: string | null;
        room_id: string | null;
        is_locked: boolean;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  const { data: sections } = await supabase
    .from("sections")
    .select("id, classes!inner(academic_year_id)")
    .eq("classes.academic_year_id", input.academicYearId);

  let sectionIds = (sections ?? []).map((s) => s.id);
  if (input.sectionId) {
    sectionIds = sectionIds.filter((id) => id === input.sectionId);
  }
  if (sectionIds.length === 0) {
    return { success: true, slots: [] };
  }

  let query = supabase
    .from("timetable_slots")
    .select(
      "id, grid_id, section_id, day_of_week, period_definition_id, subject_id, teacher_id, room_id, is_locked",
    )
    .in("section_id", sectionIds)
    .is("archived_at", null);

  if (input.gridId) {
    query = query.eq("grid_id", input.gridId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, slots: data ?? [] };
}

export async function upsertTimetableSlotAction(
  input: SlotInput,
): Promise<TimetableActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateSlotInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const sectionId = input.sectionId.trim();
  const periodId = input.periodDefinitionId.trim();
  const teacherId = input.teacherId?.trim() || null;
  const subjectId = input.subjectId?.trim() || null;
  const roomId = input.roomId?.trim() || null;
  const gridId = input.gridId?.trim() || null;

  if (!(await assertSectionInSchool(supabase, schoolId, sectionId))) {
    return { success: false, error: "Section not found." };
  }
  if (gridId && !(await assertGridOwned(supabase, schoolId, gridId))) {
    return { success: false, error: "Grid not found." };
  }
  if (teacherId && !(await assertEmploymentOwned(supabase, schoolId, teacherId))) {
    return { success: false, error: "Teacher employment not found." };
  }

  const academicYearId = await academicYearForSection(supabase, sectionId);
  if (!academicYearId) {
    return { success: false, error: "Could not resolve academic year." };
  }

  if (input.id) {
    const { data: existingSlot } = await supabase
      .from("timetable_slots")
      .select("is_locked")
      .eq("id", input.id)
      .maybeSingle();
    if (existingSlot?.is_locked) {
      return {
        success: false,
        error: "Slot is locked.",
        conflicts: [{ kind: "slot_locked", message: "Slot is locked." }],
      };
    }
  }

  const periods = await loadPeriodsForYear(supabase, academicYearId);
  const existing = await loadExistingSlotsForConflict(supabase, {
    gridId,
    academicYearId,
    excludeSlotId: input.id,
  });
  const teacherBlocks = teacherId
    ? await loadTeacherBlocks(supabase, teacherId, academicYearId)
    : [];
  const sectionBlocks = await loadSectionBlocks(
    supabase,
    sectionId,
    academicYearId,
  );

  const conflicts = detectSlotConflicts({
    candidate: {
      id: input.id,
      gridId,
      sectionId,
      dayOfWeek: input.dayOfWeek,
      periodDefinitionId: periodId,
      subjectId,
      teacherId,
      roomId,
    },
    existing,
    periods,
    teacherBlocks,
    sectionBlocks,
  });

  if (conflicts.length > 0) {
    return {
      success: false,
      error: conflicts[0].message,
      conflicts,
    };
  }

  const actorId = await getActorId(supabase);
  const payload = {
    grid_id: gridId,
    section_id: sectionId,
    day_of_week: input.dayOfWeek,
    period_definition_id: periodId,
    subject_id: subjectId,
    teacher_id: teacherId,
    room_id: roomId,
    cycle_day_id: input.cycleDayId?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("timetable_slots")
      .update(payload)
      .eq("id", input.id)
      .is("archived_at", null);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidate();
    return { success: true, message: "Slot updated.", id: input.id };
  }

  const { data, error } = await supabase
    .from("timetable_slots")
    .insert({
      ...payload,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error:
        error?.code === "23505"
          ? "Section already has a class in this period."
          : (error?.message ?? "Could not save slot."),
    };
  }

  revalidate();
  return { success: true, message: "Slot saved.", id: data.id };
}

export async function setSlotLockAction(
  slotId: string,
  locked: boolean,
): Promise<TimetableActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: slot } = await supabase
    .from("timetable_slots")
    .select("id, section_id")
    .eq("id", slotId)
    .maybeSingle();

  if (!slot) {
    return { success: false, error: "Slot not found." };
  }
  if (!(await assertSectionInSchool(supabase, schoolId, slot.section_id))) {
    return { success: false, error: "Slot not found." };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("timetable_slots")
    .update({
      is_locked: locked,
      locked_at: locked ? new Date().toISOString() : null,
      locked_by: locked ? actorId : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", slotId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return {
    success: true,
    message: locked ? "Slot locked." : "Slot unlocked.",
    id: slotId,
  };
}

export async function archiveTimetableSlotAction(
  slotId: string,
): Promise<TimetableActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: slot } = await supabase
    .from("timetable_slots")
    .select("id, section_id, is_locked")
    .eq("id", slotId)
    .maybeSingle();

  if (!slot) {
    return { success: false, error: "Slot not found." };
  }
  if (!(await assertSectionInSchool(supabase, schoolId, slot.section_id))) {
    return { success: false, error: "Slot not found." };
  }
  if (slot.is_locked) {
    return { success: false, error: "Unlock the slot before archiving." };
  }

  const { error } = await supabase
    .from("timetable_slots")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", slotId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Slot archived.", id: slotId };
}

/** Teacher allocation helper — sets teacher on a slot with conflict checks. */
export async function allocateTeacherToSlotAction(
  slotId: string,
  employmentId: string | null,
): Promise<TimetableActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: slot } = await supabase
    .from("timetable_slots")
    .select(
      "id, grid_id, section_id, day_of_week, period_definition_id, subject_id, teacher_id, room_id, is_locked",
    )
    .eq("id", slotId)
    .is("archived_at", null)
    .maybeSingle();

  if (!slot) {
    return { success: false, error: "Slot not found." };
  }

  return upsertTimetableSlotAction({
    id: slot.id,
    gridId: slot.grid_id,
    sectionId: slot.section_id,
    dayOfWeek: slot.day_of_week,
    periodDefinitionId: slot.period_definition_id,
    subjectId: slot.subject_id,
    teacherId: employmentId,
    roomId: slot.room_id,
  });
}
