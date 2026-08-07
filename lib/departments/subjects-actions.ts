"use server";

import { revalidatePath } from "next/cache";
import {
  appendDepartmentHistory,
  assertDepartmentOwned,
  assertSubjectOwned,
  getActorId,
} from "@/lib/departments/server-helpers";
import type {
  DepartmentActionResult,
  DepartmentSubjectInput,
} from "@/lib/departments/types";
import { validateDepartmentSubjectInput } from "@/lib/departments/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listDepartmentSubjectsAction(
  departmentId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      subjects: Array<{
        id: string;
        subject_id: string;
        is_primary: boolean;
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
  if (!(await assertDepartmentOwned(supabase, schoolId, departmentId))) {
    return { success: false, error: "Department not found." };
  }

  let query = supabase
    .from("department_subjects")
    .select("id, subject_id, is_primary, archived_at")
    .eq("department_id", departmentId)
    .order("created_at", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, subjects: data ?? [] };
}

export async function linkDepartmentSubjectAction(
  input: DepartmentSubjectInput,
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateDepartmentSubjectInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const departmentId = input.departmentId.trim();
  const subjectId = input.subjectId.trim();

  if (!(await assertDepartmentOwned(supabase, schoolId, departmentId))) {
    return { success: false, error: "Department not found." };
  }
  if (!(await assertSubjectOwned(supabase, schoolId, subjectId))) {
    return { success: false, error: "Subject not found." };
  }

  const actorId = await getActorId(supabase);

  const { data: active } = await supabase
    .from("department_subjects")
    .select("id, archived_at")
    .eq("department_id", departmentId)
    .eq("subject_id", subjectId)
    .is("archived_at", null)
    .maybeSingle();

  if (active) {
    const { error } = await supabase
      .from("department_subjects")
      .update({
        is_primary: input.isPrimary ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", active.id);

    if (error) {
      return { success: false, error: error.message };
    }

    await appendDepartmentHistory(supabase, {
      departmentId,
      action: "subject.updated",
      summary: "Department subject link updated",
      changes: { subjectId, isPrimary: input.isPrimary ?? false },
      actorId,
    });

    revalidatePath("/dashboard");
    return { success: true, message: "Subject link updated.", id: active.id };
  }

  const { data: archived } = await supabase
    .from("department_subjects")
    .select("id")
    .eq("department_id", departmentId)
    .eq("subject_id", subjectId)
    .not("archived_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (archived) {
    const { error } = await supabase
      .from("department_subjects")
      .update({
        archived_at: null,
        is_primary: input.isPrimary ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", archived.id);

    if (error) {
      return { success: false, error: error.message };
    }

    await appendDepartmentHistory(supabase, {
      departmentId,
      action: "subject.restored",
      summary: "Department subject link restored",
      changes: { subjectId },
      actorId,
    });

    revalidatePath("/dashboard");
    return {
      success: true,
      message: "Subject link restored.",
      id: archived.id,
    };
  }

  const { data, error } = await supabase
    .from("department_subjects")
    .insert({
      department_id: departmentId,
      subject_id: subjectId,
      is_primary: input.isPrimary ?? false,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not link subject.",
    };
  }

  await appendDepartmentHistory(supabase, {
    departmentId,
    action: "subject.linked",
    summary: "Subject linked to department",
    changes: { subjectId, isPrimary: input.isPrimary ?? false },
    actorId,
  });

  revalidatePath("/dashboard");
  return { success: true, message: "Subject linked.", id: data.id };
}

export async function unlinkDepartmentSubjectAction(
  linkId: string,
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: link } = await supabase
    .from("department_subjects")
    .select("id, department_id, subject_id")
    .eq("id", linkId)
    .maybeSingle();

  if (!link) {
    return { success: false, error: "Subject link not found." };
  }

  if (!(await assertDepartmentOwned(supabase, schoolId, link.department_id))) {
    return { success: false, error: "Department not found." };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("department_subjects")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", linkId);

  if (error) {
    return { success: false, error: error.message };
  }

  await appendDepartmentHistory(supabase, {
    departmentId: link.department_id,
    action: "subject.unlinked",
    summary: "Subject unlinked from department",
    changes: { subjectId: link.subject_id, linkId },
    actorId,
  });

  revalidatePath("/dashboard");
  return { success: true, message: "Subject unlinked.", id: linkId };
}
