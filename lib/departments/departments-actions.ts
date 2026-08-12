"use server";

import { revalidatePath } from "next/cache";
import { ensureDepartmentCode } from "@/lib/departments/codes";
import {
  appendDepartmentHistory,
  assertDepartmentOwned,
  getActorId,
} from "@/lib/departments/server-helpers";
import type { DepartmentActionResult, DepartmentInput } from "@/lib/departments/types";
import {
  trimDepartmentInput,
  validateDepartmentInput,
} from "@/lib/departments/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listDepartmentsAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | {
      success: true;
      departments: Array<{
        id: string;
        name: string;
        code: string | null;
        description: string | null;
        parent_department_id: string | null;
        cost_center_code: string | null;
        created_by: string | null;
        updated_by: string | null;
        archived_at: string | null;
        updated_at: string;
        created_at: string;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("departments")
    .select(
      "id, name, code, description, parent_department_id, cost_center_code, created_by, updated_by, archived_at, updated_at, created_at",
    )
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, departments: data ?? [] };
}

export async function createDepartmentAction(
  input: DepartmentInput,
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimDepartmentInput(input);
  const fieldErrors = validateDepartmentInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const code = ensureDepartmentCode(trimmed.name, trimmed.code);

  if (trimmed.parentDepartmentId) {
    const ok = await assertDepartmentOwned(
      supabase,
      schoolId,
      trimmed.parentDepartmentId,
    );
    if (!ok) {
      return { success: false, error: "Parent department not found." };
    }
  }

  const { data, error } = await supabase
    .from("departments")
    .insert({
      school_id: schoolId,
      name: trimmed.name,
      code,
      description: trimmed.description || null,
      parent_department_id: trimmed.parentDepartmentId,
      cost_center_code: trimmed.costCenterCode,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create department.",
    };
  }

  await appendDepartmentHistory(supabase, {
    departmentId: data.id,
    action: "department.created",
    summary: `Created department ${trimmed.name}`,
    changes: { name: trimmed.name, code },
    actorId,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/departments");
  revalidatePath("/dashboard/configuration");
  return { success: true, message: "Department created.", id: data.id };
}

export async function updateDepartmentAction(
  input: DepartmentInput & { id: string },
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimDepartmentInput(input);
  const fieldErrors = validateDepartmentInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (!(await assertDepartmentOwned(supabase, schoolId, input.id))) {
    return { success: false, error: "Department not found." };
  }

  if (trimmed.parentDepartmentId === input.id) {
    return { success: false, error: "Department cannot be its own parent." };
  }

  const actorId = await getActorId(supabase);
  const code = ensureDepartmentCode(trimmed.name, trimmed.code);

  const { error } = await supabase
    .from("departments")
    .update({
      name: trimmed.name,
      code,
      description: trimmed.description || null,
      parent_department_id: trimmed.parentDepartmentId,
      cost_center_code: trimmed.costCenterCode,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("school_id", schoolId)
    .is("archived_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  await appendDepartmentHistory(supabase, {
    departmentId: input.id,
    action: "department.updated",
    summary: `Updated department ${trimmed.name}`,
    changes: {
      name: trimmed.name,
      code,
      description: trimmed.description || null,
      parentDepartmentId: trimmed.parentDepartmentId,
    },
    actorId,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/departments");
  revalidatePath("/dashboard/configuration");
  return { success: true, message: "Department updated.", id: input.id };
}

export async function archiveDepartmentAction(
  departmentId: string,
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("departments")
    .update({
      archived_at: now,
      updated_by: actorId,
      updated_at: now,
    })
    .eq("id", departmentId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  await appendDepartmentHistory(supabase, {
    departmentId,
    action: "department.archived",
    summary: "Department archived",
    actorId,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/departments");
  revalidatePath("/dashboard/configuration");
  return { success: true, message: "Department archived.", id: departmentId };
}

export async function restoreDepartmentAction(
  departmentId: string,
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("departments")
    .update({
      archived_at: null,
      updated_by: actorId,
      updated_at: now,
    })
    .eq("id", departmentId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  await appendDepartmentHistory(supabase, {
    departmentId,
    action: "department.restored",
    summary: "Department restored",
    actorId,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/departments");
  revalidatePath("/dashboard/configuration");
  return { success: true, message: "Department restored.", id: departmentId };
}

export async function listDepartmentHistoryAction(
  departmentId: string,
): Promise<
  | {
      success: true;
      history: Array<{
        id: string;
        action: string;
        summary: string | null;
        changes: unknown;
        actor_id: string | null;
        created_at: string;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: dept } = await supabase
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!dept) {
    return { success: false, error: "Department not found." };
  }

  const { data, error } = await supabase
    .from("department_history")
    .select("id, action, summary, changes, actor_id, created_at")
    .eq("department_id", departmentId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, history: data ?? [] };
}
