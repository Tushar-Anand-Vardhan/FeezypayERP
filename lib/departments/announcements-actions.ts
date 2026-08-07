"use server";

import { revalidatePath } from "next/cache";
import {
  appendDepartmentHistory,
  assertDepartmentOwned,
  getActorId,
} from "@/lib/departments/server-helpers";
import type {
  AnnouncementInput,
  DepartmentActionResult,
} from "@/lib/departments/types";
import {
  trimAnnouncementInput,
  validateAnnouncementInput,
} from "@/lib/departments/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listDepartmentAnnouncementsAction(
  departmentId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      announcements: Array<{
        id: string;
        title: string;
        body: string;
        visibility: string;
        status: string;
        published_at: string | null;
        created_by: string | null;
        archived_at: string | null;
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
  if (!(await assertDepartmentOwned(supabase, schoolId, departmentId))) {
    return { success: false, error: "Department not found." };
  }

  let query = supabase
    .from("department_announcements")
    .select(
      "id, title, body, visibility, status, published_at, created_by, archived_at, created_at",
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

  return { success: true, announcements: data ?? [] };
}

export async function createDepartmentAnnouncementAction(
  input: AnnouncementInput,
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimAnnouncementInput(input);
  const fieldErrors = validateAnnouncementInput(trimmed);
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
  const status = trimmed.status ?? "draft";
  const publishedAt =
    status === "published" ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("department_announcements")
    .insert({
      department_id: trimmed.departmentId,
      title: trimmed.title,
      body: trimmed.body || "",
      visibility: trimmed.visibility ?? "department",
      status,
      published_at: publishedAt,
      notify_on_publish: trimmed.notifyOnPublish ?? false,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create announcement.",
    };
  }

  await appendDepartmentHistory(supabase, {
    departmentId: trimmed.departmentId,
    action: "announcement.created",
    summary: `Announcement: ${trimmed.title}`,
    changes: { announcementId: data.id, status },
    actorId,
  });

  revalidatePath("/dashboard");
  return { success: true, message: "Announcement created.", id: data.id };
}

export async function updateDepartmentAnnouncementAction(
  input: AnnouncementInput & { id: string },
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimAnnouncementInput(input);
  const fieldErrors = validateAnnouncementInput(trimmed);
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
  const status = trimmed.status ?? "draft";
  const payload: Record<string, unknown> = {
    title: trimmed.title,
    body: trimmed.body || "",
    visibility: trimmed.visibility ?? "department",
    status,
    notify_on_publish: trimmed.notifyOnPublish ?? false,
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };

  if (status === "published") {
    payload.published_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("department_announcements")
    .update(payload)
    .eq("id", input.id)
    .eq("department_id", trimmed.departmentId)
    .is("archived_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  await appendDepartmentHistory(supabase, {
    departmentId: trimmed.departmentId,
    action: "announcement.updated",
    summary: `Updated announcement: ${trimmed.title}`,
    changes: { announcementId: input.id, status },
    actorId,
  });

  revalidatePath("/dashboard");
  return { success: true, message: "Announcement updated.", id: input.id };
}

export async function archiveDepartmentAnnouncementAction(
  announcementId: string,
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: row } = await supabase
    .from("department_announcements")
    .select("id, department_id")
    .eq("id", announcementId)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Announcement not found." };
  }

  if (!(await assertDepartmentOwned(supabase, schoolId, row.department_id))) {
    return { success: false, error: "Department not found." };
  }

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("department_announcements")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", announcementId);

  if (error) {
    return { success: false, error: error.message };
  }

  await appendDepartmentHistory(supabase, {
    departmentId: row.department_id,
    action: "announcement.archived",
    summary: "Announcement archived",
    changes: { announcementId },
    actorId,
  });

  revalidatePath("/dashboard");
  return {
    success: true,
    message: "Announcement archived.",
    id: announcementId,
  };
}
