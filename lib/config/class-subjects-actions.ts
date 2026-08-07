"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import type { ConfigActionResult } from "@/lib/config/types";

export type ClassSubjectAssignmentInput = {
  classId: string;
  assignments: Array<{ subjectId: string; isElective: boolean }>;
};

async function verifyOwnedClassIds(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  schoolId: string,
  classIds: string[],
): Promise<{ error?: string }> {
  if (classIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("classes")
    .select("id, academic_years!inner(school_id)")
    .in("id", classIds)
    .eq("academic_years.school_id", schoolId);

  if (error) {
    return { error: error.message };
  }

  if ((data ?? []).length !== new Set(classIds).size) {
    return { error: "One or more classes are not in your school." };
  }

  return {};
}

async function verifyActiveSubjectIds(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  schoolId: string,
  subjectIds: string[],
): Promise<{ error?: string }> {
  if (subjectIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("subjects")
    .select("id")
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .in("id", subjectIds);

  if (error) {
    return { error: error.message };
  }

  if ((data ?? []).length !== new Set(subjectIds).size) {
    return { error: "One or more subjects are missing or archived." };
  }

  return {};
}

/**
 * Replace class↔subject offer rows for the given classes.
 * Does not create/delete subjects (E07 catalog stays stable).
 */
export async function replaceClassSubjectsAction(
  rows: ClassSubjectAssignmentInput[],
): Promise<ConfigActionResult> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const classIds = rows.map((row) => row.classId);
  const classCheck = await verifyOwnedClassIds(supabase, schoolId, classIds);
  if (classCheck.error) {
    return { success: false, error: classCheck.error };
  }

  const allSubjectIds = rows.flatMap((row) =>
    row.assignments.map((assignment) => assignment.subjectId),
  );
  const subjectCheck = await verifyActiveSubjectIds(
    supabase,
    schoolId,
    allSubjectIds,
  );
  if (subjectCheck.error) {
    return { success: false, error: subjectCheck.error };
  }

  for (const row of rows) {
    const { error: deleteError } = await supabase
      .from("class_subjects")
      .delete()
      .eq("class_id", row.classId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    if (row.assignments.length === 0) {
      continue;
    }

    const { error: insertError } = await supabase.from("class_subjects").insert(
      row.assignments.map((assignment) => ({
        class_id: row.classId,
        subject_id: assignment.subjectId,
        is_elective: assignment.isElective,
      })),
    );

    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "Class subjects saved." };
}
