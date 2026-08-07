import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function assertYearOwned(
  supabase: Supabase,
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

export async function assertGridOwned(
  supabase: Supabase,
  schoolId: string,
  gridId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("timetable_grids")
    .select("id")
    .eq("id", gridId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertSectionInSchool(
  supabase: Supabase,
  schoolId: string,
  sectionId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("sections")
    .select("id, classes!inner(academic_years!inner(school_id))")
    .eq("id", sectionId)
    .eq("classes.academic_years.school_id", schoolId)
    .maybeSingle();
  return Boolean(data);
}

export async function assertEmploymentOwned(
  supabase: Supabase,
  schoolId: string,
  employmentId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("teacher_employments")
    .select("id")
    .eq("id", employmentId)
    .eq("school_id", schoolId)
    .eq("status", "active")
    .maybeSingle();
  return Boolean(data);
}

export async function loadPeriodsForYear(
  supabase: Supabase,
  academicYearId: string,
) {
  const { data } = await supabase
    .from("period_definitions")
    .select("id, period_number, start_time, end_time, is_break, is_locked")
    .eq("academic_year_id", academicYearId)
    .is("archived_at", null)
    .order("period_number");

  return (data ?? []).map((row) => ({
    id: row.id,
    periodNumber: row.period_number,
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    isBreak: row.is_break,
    isLocked: row.is_locked,
  }));
}

export async function loadExistingSlotsForConflict(
  supabase: Supabase,
  input: {
    gridId?: string | null;
    academicYearId: string;
    excludeSlotId?: string;
  },
) {
  let sectionQuery = supabase
    .from("sections")
    .select("id, classes!inner(academic_year_id)")
    .eq("classes.academic_year_id", input.academicYearId);

  const { data: sections } = await sectionQuery;
  const sectionIds = (sections ?? []).map((s) => s.id);
  if (sectionIds.length === 0) {
    return [];
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

  const { data } = await query;
  return (data ?? [])
    .filter((row) => row.id !== input.excludeSlotId)
    .map((row) => ({
      id: row.id,
      gridId: row.grid_id,
      sectionId: row.section_id,
      dayOfWeek: row.day_of_week,
      periodDefinitionId: row.period_definition_id,
      subjectId: row.subject_id,
      teacherId: row.teacher_id,
      roomId: row.room_id,
      isLocked: row.is_locked,
    }));
}

export async function loadTeacherBlocks(
  supabase: Supabase,
  employmentId: string,
  academicYearId: string,
) {
  const { data } = await supabase
    .from("teacher_availability")
    .select("day_of_week, period_definition_id, is_available")
    .eq("employment_id", employmentId)
    .eq("academic_year_id", academicYearId)
    .is("archived_at", null)
    .eq("is_available", false);

  return (data ?? []).map((row) => ({
    dayOfWeek: row.day_of_week,
    periodDefinitionId: row.period_definition_id,
    isAvailable: row.is_available,
  }));
}

export async function loadSectionBlocks(
  supabase: Supabase,
  sectionId: string,
  academicYearId: string,
) {
  const { data } = await supabase
    .from("section_availability")
    .select("day_of_week, period_definition_id, is_available")
    .eq("section_id", sectionId)
    .eq("academic_year_id", academicYearId)
    .is("archived_at", null)
    .eq("is_available", false);

  return (data ?? []).map((row) => ({
    dayOfWeek: row.day_of_week,
    periodDefinitionId: row.period_definition_id,
    isAvailable: row.is_available,
  }));
}
