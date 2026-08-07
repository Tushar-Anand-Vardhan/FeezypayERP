"use server";

import { revalidatePath } from "next/cache";
import {
  appendDepartmentHistory,
  assertDepartmentOwned,
  assertEmploymentOwned,
  assertSubjectOwned,
  getActorId,
} from "@/lib/departments/server-helpers";
import type {
  DepartmentActionResult,
  TeachingAssignmentInput,
} from "@/lib/departments/types";
import { validateTeachingAssignmentInput } from "@/lib/departments/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listDepartmentTeachingAssignmentsAction(
  departmentId: string,
  options?: { includeEnded?: boolean },
): Promise<
  | {
      success: true;
      assignments: Array<{
        id: string;
        employment_id: string;
        subject_id: string;
        academic_year_id: string | null;
        started_on: string;
        ended_on: string | null;
        notes: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertDepartmentOwned(supabase, schoolId, departmentId))) {
    return { success: false, error: "Department not found." };
  }

  let query = supabase
    .from("department_teaching_assignments")
    .select(
      "id, employment_id, subject_id, academic_year_id, started_on, ended_on, notes",
    )
    .eq("department_id", departmentId)
    .order("started_on", { ascending: false });

  if (!options?.includeEnded) {
    query = query.is("ended_on", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, assignments: data ?? [] };
}

export async function createDepartmentTeachingAssignmentAction(
  input: TeachingAssignmentInput,
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateTeachingAssignmentInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const departmentId = input.departmentId.trim();
  const employmentId = input.employmentId.trim();
  const subjectId = input.subjectId.trim();
  const academicYearId = input.academicYearId?.trim() || null;

  if (!(await assertDepartmentOwned(supabase, schoolId, departmentId))) {
    return { success: false, error: "Department not found." };
  }
  if (!(await assertEmploymentOwned(supabase, schoolId, employmentId))) {
    return { success: false, error: "Active employment not found." };
  }
  if (!(await assertSubjectOwned(supabase, schoolId, subjectId))) {
    return { success: false, error: "Subject not found." };
  }

  if (academicYearId) {
    const { data: year } = await supabase
      .from("academic_years")
      .select("id")
      .eq("id", academicYearId)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .maybeSingle();
    if (!year) {
      return { success: false, error: "Academic year not found." };
    }
  }

  const actorId = await getActorId(supabase);

  const { data, error } = await supabase
    .from("department_teaching_assignments")
    .insert({
      department_id: departmentId,
      employment_id: employmentId,
      subject_id: subjectId,
      academic_year_id: academicYearId,
      started_on: input.startedOn || new Date().toISOString().slice(0, 10),
      notes: input.notes?.trim() || null,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create teaching assignment.",
    };
  }

  await appendDepartmentHistory(supabase, {
    departmentId,
    action: "assignment.created",
    summary: "Teaching assignment created",
    changes: {
      assignmentId: data.id,
      employmentId,
      subjectId,
      academicYearId,
    },
    actorId,
  });

  revalidatePath("/dashboard");
  return {
    success: true,
    message: "Teaching assignment created.",
    id: data.id,
  };
}

export async function endDepartmentTeachingAssignmentAction(
  assignmentId: string,
  endedOn?: string,
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: row } = await supabase
    .from("department_teaching_assignments")
    .select("id, department_id, employment_id, subject_id, ended_on")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Assignment not found." };
  }

  if (!(await assertDepartmentOwned(supabase, schoolId, row.department_id))) {
    return { success: false, error: "Department not found." };
  }

  if (row.ended_on) {
    return { success: false, error: "Assignment already ended." };
  }

  const actorId = await getActorId(supabase);
  const endDate = endedOn || new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("department_teaching_assignments")
    .update({
      ended_on: endDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId);

  if (error) {
    return { success: false, error: error.message };
  }

  await appendDepartmentHistory(supabase, {
    departmentId: row.department_id,
    action: "assignment.ended",
    summary: "Teaching assignment ended",
    changes: {
      assignmentId,
      employmentId: row.employment_id,
      subjectId: row.subject_id,
      endedOn: endDate,
    },
    actorId,
  });

  revalidatePath("/dashboard");
  return { success: true, message: "Teaching assignment ended.", id: assignmentId };
}
