"use server";

import { revalidatePath } from "next/cache";
import {
  assertEmploymentOwned,
  assertEventOwned,
  getActorId,
  writeEventAudit,
} from "@/lib/events/server-helpers";
import type {
  EventActivityActionResult,
  StaffAssignmentInput,
} from "@/lib/events/types";
import { validateStaffAssignmentInput } from "@/lib/events/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/events");
}

export async function upsertEventStaffAssignmentAction(
  input: StaffAssignmentInput,
): Promise<EventActivityActionResult> {
  const context = await getAuthenticatedSchoolContext("engagement.event.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateStaffAssignmentInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const event = await assertEventOwned(
    supabase,
    schoolId,
    input.calendarEventId,
  );
  if (!event.ok) {
    return { success: false, error: "Event not found on calendar." };
  }
  if (
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const role = input.role ?? "in_charge";
  const { data: existing } = await supabase
    .from("event_staff_assignments")
    .select("id")
    .eq("calendar_event_id", input.calendarEventId)
    .eq("employment_id", input.employmentId)
    .eq("role", role)
    .is("archived_at", null)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("event_staff_assignments")
      .update({
        remarks: input.remarks ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      return { success: false, error: error.message };
    }
    await writeEventAudit(supabase, {
      schoolId,
      action: "staff.updated",
      actorId,
      calendarEventId: input.calendarEventId,
      employmentId: input.employmentId,
    });
    revalidate();
    return {
      success: true,
      message: "Staff assignment updated.",
      id: existing.id,
    };
  }

  const { data: inserted, error } = await supabase
    .from("event_staff_assignments")
    .insert({
      school_id: schoolId,
      calendar_event_id: input.calendarEventId,
      employment_id: input.employmentId,
      role,
      remarks: input.remarks ?? null,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !inserted) {
    return {
      success: false,
      error: error?.message ?? "Failed to assign staff.",
    };
  }

  await writeEventAudit(supabase, {
    schoolId,
    action: "staff.assigned",
    actorId,
    calendarEventId: input.calendarEventId,
    employmentId: input.employmentId,
    newValues: { role },
  });

  revalidate();
  return {
    success: true,
    message: "Teacher assigned to event.",
    id: inserted.id,
  };
}

export async function archiveEventStaffAssignmentAction(
  assignmentId: string,
): Promise<EventActivityActionResult> {
  const context = await getAuthenticatedSchoolContext("engagement.event.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data } = await supabase
    .from("event_staff_assignments")
    .select("id, calendar_event_id, employment_id")
    .eq("id", assignmentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!data) {
    return { success: false, error: "Assignment not found." };
  }

  const { error } = await supabase
    .from("event_staff_assignments")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeEventAudit(supabase, {
    schoolId,
    action: "staff.archived",
    actorId,
    calendarEventId: data.calendar_event_id,
    employmentId: data.employment_id,
  });

  revalidate();
  return { success: true, message: "Staff assignment archived.", id: assignmentId };
}
