"use server";

import { revalidatePath } from "next/cache";
import { getActiveYearClassesForSchool } from "@/lib/onboarding/school-classes-server";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import {
  validateTimetableForm,
  type ClassTeacherAssignment,
  type PeriodFormRow,
  type TimetableSlotFormRow,
} from "@/lib/onboarding/timetable";

type Result =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type TimetableStepData =
  | {
      success: true;
      blocked: false;
      periods: PeriodFormRow[];
      sections: Array<{
        id: string;
        name: string;
        className: string;
        classTeacherId: string;
      }>;
      subjects: Array<{ id: string; name: string }>;
      teachers: Array<{ id: string; name: string }>;
      slots: TimetableSlotFormRow[];
      timetableSkipped: boolean;
    }
  | { success: true; blocked: true }
  | { success: false; error: string };

export async function getTimetableStepDataAction(): Promise<TimetableStepData> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const classesResult = await getActiveYearClassesForSchool(supabase, schoolId);
  if ("blocked" in classesResult || "error" in classesResult) {
    if ("error" in classesResult) {
      return { success: false, error: classesResult.error };
    }
    return { success: true, blocked: true };
  }

  const { data: school } = await supabase
    .from("schools")
    .select("timetable_skipped")
    .eq("id", schoolId)
    .maybeSingle();

  const classIds = classesResult.classes.map((row) => row.id);
  const [{ data: sections }, { data: subjects }, { data: teachers }, { data: periods }] =
    await Promise.all([
      supabase
        .from("sections")
        .select("id, name, class_id, class_teacher_id")
        .in("class_id", classIds)
        .order("display_order"),
      supabase
        .from("subjects")
        .select("id, name")
        .eq("school_id", schoolId)
        .is("archived_at", null),
      supabase
        .from("teacher_employments")
        .select(
          "id, teacher_profiles(persons(full_name))",
        )
        .eq("school_id", schoolId)
        .eq("status", "active"),
      supabase
        .from("period_definitions")
        .select("period_number, start_time, end_time")
        .eq("academic_year_id", classesResult.academicYear.id)
        .order("period_number"),
    ]);

  if (!sections || sections.length === 0 || !teachers || teachers.length === 0) {
    return { success: true, blocked: true };
  }

  const classNameById = new Map(
    classesResult.classes.map((row) => [row.id, row.name]),
  );

  const periodIds = await supabase
    .from("period_definitions")
    .select("id, period_number")
    .eq("academic_year_id", classesResult.academicYear.id);

  const periodNumberById = new Map(
    (periodIds.data ?? []).map((row) => [row.id, row.period_number]),
  );

  const { data: slots } = await supabase
    .from("timetable_slots")
    .select("section_id, day_of_week, period_definition_id, subject_id, teacher_id")
    .in(
      "section_id",
      sections.map((row) => row.id),
    );

  return {
    success: true,
    blocked: false,
    periods: (periods ?? []).map((row) => ({
      periodNumber: row.period_number,
      startTime: String(row.start_time).slice(0, 5),
      endTime: String(row.end_time).slice(0, 5),
    })),
    sections: sections.map((section) => ({
      id: section.id,
      name: section.name,
      className: classNameById.get(section.class_id) ?? "",
      classTeacherId: section.class_teacher_id ?? "",
    })),
    subjects: subjects ?? [],
    teachers: (teachers ?? []).map((row) => {
      const profile = row.teacher_profiles as
        | {
            persons:
              | { full_name: string }
              | { full_name: string }[]
              | null;
          }
        | {
            persons:
              | { full_name: string }
              | { full_name: string }[]
              | null;
          }[]
        | null;
      const resolvedProfile = Array.isArray(profile) ? profile[0] : profile;
      const personRaw = resolvedProfile?.persons;
      const person = Array.isArray(personRaw) ? personRaw[0] : personRaw;
      return {
        id: row.id,
        name: person?.full_name ?? "Teacher",
      };
    }),
    slots: (slots ?? []).map((slot) => ({
      sectionId: slot.section_id,
      dayOfWeek: slot.day_of_week,
      periodNumber: periodNumberById.get(slot.period_definition_id) ?? 0,
      subjectId: slot.subject_id ?? "",
      teacherId: slot.teacher_id ?? "",
    })),
    timetableSkipped: Boolean(school?.timetable_skipped),
  };
}

export async function saveTimetableAction(formData: FormData): Promise<Result> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const skip = String(formData.get("skip") ?? "false") === "true";

  if (skip) {
    await supabase
      .from("schools")
      .update({
        timetable_skipped: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", schoolId);
    revalidatePath("/onboarding", "layout");
    return { success: true, message: "Timetable marked as skip for now." };
  }

  let periods: PeriodFormRow[] = [];
  let slots: TimetableSlotFormRow[] = [];
  let classTeachers: ClassTeacherAssignment[] = [];
  try {
    periods = JSON.parse(String(formData.get("periods") ?? "[]")) as PeriodFormRow[];
    slots = JSON.parse(String(formData.get("slots") ?? "[]")) as TimetableSlotFormRow[];
    classTeachers = JSON.parse(
      String(formData.get("classTeachers") ?? "[]"),
    ) as ClassTeacherAssignment[];
  } catch {
    return { success: false, error: "Could not read timetable data." };
  }

  const fieldErrors = validateTimetableForm({
    periods,
    requireConfigured: true,
  });
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const classesResult = await getActiveYearClassesForSchool(supabase, schoolId);
  if ("error" in classesResult || "blocked" in classesResult) {
    return {
      success: false,
      error:
        "error" in classesResult
          ? classesResult.error
          : "Complete earlier setup first.",
    };
  }

  const academicYearId = classesResult.academicYear.id;

  await supabase
    .from("period_definitions")
    .delete()
    .eq("academic_year_id", academicYearId);

  const { data: insertedPeriods, error: periodError } = await supabase
    .from("period_definitions")
    .insert(
      periods.map((period) => ({
        academic_year_id: academicYearId,
        period_number: period.periodNumber,
        start_time: period.startTime,
        end_time: period.endTime,
      })),
    )
    .select("id, period_number");

  if (periodError || !insertedPeriods) {
    return {
      success: false,
      error: periodError?.message ?? "Could not save periods.",
    };
  }

  const periodIdByNumber = new Map(
    insertedPeriods.map((row) => [row.period_number, row.id]),
  );

  const classIds = classesResult.classes.map((row) => row.id);
  const { data: sections } = await supabase
    .from("sections")
    .select("id")
    .in("class_id", classIds);
  const sectionIds = (sections ?? []).map((row) => row.id);

  if (sectionIds.length > 0) {
    await supabase.from("timetable_slots").delete().in("section_id", sectionIds);
  }

  const slotRows = slots
    .filter((slot) => slot.subjectId || slot.teacherId)
    .map((slot) => ({
      section_id: slot.sectionId,
      day_of_week: slot.dayOfWeek,
      period_definition_id: periodIdByNumber.get(slot.periodNumber)!,
      subject_id: slot.subjectId || null,
      teacher_id: slot.teacherId || null,
    }))
    .filter((row) => row.period_definition_id);

  if (slotRows.length > 0) {
    const { error: slotError } = await supabase
      .from("timetable_slots")
      .insert(slotRows);
    if (slotError) {
      return { success: false, error: slotError.message };
    }
  }

  for (const assignment of classTeachers) {
    await supabase
      .from("sections")
      .update({ class_teacher_id: assignment.teacherId || null })
      .eq("id", assignment.sectionId);
  }

  await supabase
    .from("schools")
    .update({
      timetable_skipped: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", schoolId);

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "Timetable saved successfully." };
}
