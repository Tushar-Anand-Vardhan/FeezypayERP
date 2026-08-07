"use server";

import { revalidatePath } from "next/cache";
import {
  appendDepartmentHistory,
  assertDepartmentOwned,
  getActorId,
} from "@/lib/departments/server-helpers";
import type {
  DepartmentActionResult,
  ResourceInput,
} from "@/lib/departments/types";
import {
  trimResourceInput,
  validateResourceInput,
} from "@/lib/departments/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listDepartmentResourcesAction(
  departmentId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      resources: Array<{
        id: string;
        title: string;
        description: string | null;
        resource_type: string;
        url: string | null;
        media_id: string | null;
        created_by: string | null;
        archived_at: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertDepartmentOwned(supabase, schoolId, departmentId))) {
    return { success: false, error: "Department not found." };
  }

  let query = supabase
    .from("department_resources")
    .select(
      "id, title, description, resource_type, url, media_id, created_by, archived_at",
    )
    .eq("department_id", departmentId)
    .order("created_at", { ascending: false });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, resources: data ?? [] };
}

export async function createDepartmentResourceAction(
  input: ResourceInput,
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimResourceInput(input);
  const fieldErrors = validateResourceInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (
    !(await assertDepartmentOwned(supabase, schoolId, trimmed.departmentId))
  ) {
    return { success: false, error: "Department not found." };
  }

  const actorId = await getActorId(supabase);
  const { data, error } = await supabase
    .from("department_resources")
    .insert({
      department_id: trimmed.departmentId,
      title: trimmed.title,
      description: trimmed.description || null,
      resource_type: trimmed.resourceType ?? "link",
      url: trimmed.url || null,
      media_id: trimmed.mediaId,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create resource.",
    };
  }

  await appendDepartmentHistory(supabase, {
    departmentId: trimmed.departmentId,
    action: "resource.created",
    summary: `Resource: ${trimmed.title}`,
    changes: { resourceId: data.id, resourceType: trimmed.resourceType },
    actorId,
  });

  revalidatePath("/dashboard");
  return { success: true, message: "Resource created.", id: data.id };
}

export async function updateDepartmentResourceAction(
  input: ResourceInput & { id: string },
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimResourceInput(input);
  const fieldErrors = validateResourceInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (
    !(await assertDepartmentOwned(supabase, schoolId, trimmed.departmentId))
  ) {
    return { success: false, error: "Department not found." };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("department_resources")
    .update({
      title: trimmed.title,
      description: trimmed.description || null,
      resource_type: trimmed.resourceType ?? "link",
      url: trimmed.url || null,
      media_id: trimmed.mediaId,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("department_id", trimmed.departmentId)
    .is("archived_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  await appendDepartmentHistory(supabase, {
    departmentId: trimmed.departmentId,
    action: "resource.updated",
    summary: `Updated resource: ${trimmed.title}`,
    changes: { resourceId: input.id },
    actorId,
  });

  revalidatePath("/dashboard");
  return { success: true, message: "Resource updated.", id: input.id };
}

export async function archiveDepartmentResourceAction(
  resourceId: string,
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: row } = await supabase
    .from("department_resources")
    .select("id, department_id")
    .eq("id", resourceId)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Resource not found." };
  }

  if (!(await assertDepartmentOwned(supabase, schoolId, row.department_id))) {
    return { success: false, error: "Department not found." };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("department_resources")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", resourceId);

  if (error) {
    return { success: false, error: error.message };
  }

  await appendDepartmentHistory(supabase, {
    departmentId: row.department_id,
    action: "resource.archived",
    summary: "Resource archived",
    changes: { resourceId },
    actorId,
  });

  revalidatePath("/dashboard");
  return { success: true, message: "Resource archived.", id: resourceId };
}
