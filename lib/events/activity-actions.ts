"use server";

import { revalidatePath } from "next/cache";
import {
  assertClubOwned,
  assertHouseOwned,
  assertYearOwned,
  getActorId,
  writeEventAudit,
} from "@/lib/events/server-helpers";
import type {
  CreateActivityEventInput,
  EventActivityActionResult,
} from "@/lib/events/types";
import { validateCreateActivityEventInput } from "@/lib/events/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/teacher");
}

/**
 * Create an activity that originates on the Academic Calendar (`calendar_events`).
 * Holidays remain E08 — never create activities as holidays.
 */
export async function createActivityEventAction(
  input: CreateActivityEventInput,
): Promise<EventActivityActionResult> {
  const context = await getAuthenticatedSchoolContext("engagement.event.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateCreateActivityEventInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }
  if (
    input.houseId &&
    !(await assertHouseOwned(supabase, schoolId, input.houseId))
  ) {
    return { success: false, error: "House not found." };
  }
  if (
    input.clubId &&
    !(await assertClubOwned(supabase, schoolId, input.clubId))
  ) {
    return { success: false, error: "Club not found." };
  }

  const { data: event, error } = await supabase
    .from("calendar_events")
    .insert({
      school_id: schoolId,
      academic_year_id: input.academicYearId,
      term_id: input.termId ?? null,
      title: input.title.trim(),
      description: input.description ?? null,
      category: input.category,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      is_all_day: Boolean(input.isAllDay),
      location: input.location ?? null,
      visibility: "school",
      audience: {},
      approval_status: input.approvalStatus ?? "draft",
      created_by: actorId,
      attendance_required: Boolean(input.attendanceRequired),
      certificate_enabled: Boolean(input.certificateEnabled),
      house_id: input.houseId ?? null,
      club_id: input.clubId ?? null,
      attachment_media_ids: input.attachmentMediaIds ?? [],
      photo_media_ids: input.photoMediaIds ?? [],
    })
    .select("id")
    .maybeSingle();

  if (error || !event) {
    return {
      success: false,
      error: error?.message ?? "Failed to create activity event.",
    };
  }

  if (input.clubId) {
    await supabase.from("club_event_links").insert({
      club_id: input.clubId,
      calendar_event_id: event.id,
      title: input.title.trim(),
    });
  }

  await writeEventAudit(supabase, {
    schoolId,
    action: "activity.created",
    actorId,
    calendarEventId: event.id,
    newValues: {
      category: input.category,
      house_id: input.houseId ?? null,
      club_id: input.clubId ?? null,
    },
  });

  revalidate();
  return {
    success: true,
    message: "Activity created on academic calendar.",
    id: event.id,
  };
}

export async function updateActivityEventMetaAction(input: {
  calendarEventId: string;
  houseId?: string | null;
  clubId?: string | null;
  certificateEnabled?: boolean;
  attendanceRequired?: boolean;
  attachmentMediaIds?: string[];
  photoMediaIds?: string[];
}): Promise<EventActivityActionResult> {
  const context = await getAuthenticatedSchoolContext("engagement.event.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const { data: existing } = await supabase
    .from("calendar_events")
    .select("id, archived_at")
    .eq("id", input.calendarEventId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!existing || existing.archived_at) {
    return { success: false, error: "Event not found." };
  }

  if (
    input.houseId &&
    !(await assertHouseOwned(supabase, schoolId, input.houseId))
  ) {
    return { success: false, error: "House not found." };
  }
  if (
    input.clubId &&
    !(await assertClubOwned(supabase, schoolId, input.clubId))
  ) {
    return { success: false, error: "Club not found." };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.houseId !== undefined) patch.house_id = input.houseId;
  if (input.clubId !== undefined) patch.club_id = input.clubId;
  if (input.certificateEnabled !== undefined) {
    patch.certificate_enabled = input.certificateEnabled;
  }
  if (input.attendanceRequired !== undefined) {
    patch.attendance_required = input.attendanceRequired;
  }
  if (input.attachmentMediaIds !== undefined) {
    patch.attachment_media_ids = input.attachmentMediaIds;
  }
  if (input.photoMediaIds !== undefined) {
    patch.photo_media_ids = input.photoMediaIds;
  }

  const { error } = await supabase
    .from("calendar_events")
    .update(patch)
    .eq("id", input.calendarEventId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeEventAudit(supabase, {
    schoolId,
    action: "activity.meta_updated",
    actorId,
    calendarEventId: input.calendarEventId,
    newValues: patch,
  });

  revalidate();
  return {
    success: true,
    message: "Activity metadata updated.",
    id: input.calendarEventId,
  };
}
