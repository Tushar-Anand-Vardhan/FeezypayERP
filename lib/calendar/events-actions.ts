"use server";

import { revalidatePath } from "next/cache";
import type {
  CalendarActionResult,
  CalendarEventApprovalStatus,
  CalendarEventInput,
} from "@/lib/calendar/types";
import {
  trimCalendarEventInput,
  validateCalendarEventInput,
} from "@/lib/calendar/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

async function actorId(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

function audienceToJson(audience: CalendarEventInput["audience"]) {
  return {
    class_ids: audience?.classIds ?? [],
    section_ids: audience?.sectionIds ?? [],
    role_keys: audience?.roleKeys ?? [],
  };
}

export async function listCalendarEventsAction(input: {
  academicYearId: string;
  includeArchived?: boolean;
}): Promise<
  | {
      success: true;
      events: Array<{
        id: string;
        title: string;
        description: string | null;
        category: string;
        starts_at: string;
        ends_at: string;
        is_all_day: boolean;
        location: string | null;
        visibility: string;
        audience: unknown;
        approval_status: string;
        term_id: string | null;
        created_by: string | null;
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
  let query = supabase
    .from("calendar_events")
    .select(
      "id, title, description, category, starts_at, ends_at, is_all_day, location, visibility, audience, approval_status, term_id, created_by, archived_at",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .order("starts_at", { ascending: true });

  if (!input.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, events: data ?? [] };
}

export async function createCalendarEventAction(
  input: CalendarEventInput,
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimCalendarEventInput(input);
  const fieldErrors = validateCalendarEventInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const createdBy = await actorId(supabase);

  const { data: year } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", trimmed.academicYearId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!year) {
    return { success: false, error: "Academic year not found." };
  }

  if (trimmed.termId) {
    const { data: term } = await supabase
      .from("terms")
      .select("id")
      .eq("id", trimmed.termId)
      .eq("academic_year_id", trimmed.academicYearId)
      .maybeSingle();
    if (!term) {
      return { success: false, error: "Term not found for this year." };
    }
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      school_id: schoolId,
      academic_year_id: trimmed.academicYearId,
      term_id: trimmed.termId || null,
      title: trimmed.title,
      description: trimmed.description || null,
      category: trimmed.category,
      starts_at: trimmed.startsAt,
      ends_at: trimmed.endsAt,
      is_all_day: trimmed.isAllDay ?? false,
      location: trimmed.location || null,
      visibility: trimmed.visibility ?? "school",
      audience: audienceToJson(trimmed.audience),
      approval_status: trimmed.approvalStatus ?? "draft",
      created_by: createdBy,
      notify_on_publish: trimmed.notifyOnPublish ?? true,
      attendance_required: trimmed.attendanceRequired ?? false,
      recurrence_rule: trimmed.recurrenceRule || null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create event.",
    };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Event created.", id: data.id };
}

export async function updateCalendarEventAction(
  input: CalendarEventInput & { id: string },
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimCalendarEventInput(input);
  const fieldErrors = validateCalendarEventInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const { error } = await supabase
    .from("calendar_events")
    .update({
      term_id: trimmed.termId || null,
      title: trimmed.title,
      description: trimmed.description || null,
      category: trimmed.category,
      starts_at: trimmed.startsAt,
      ends_at: trimmed.endsAt,
      is_all_day: trimmed.isAllDay ?? false,
      location: trimmed.location || null,
      visibility: trimmed.visibility ?? "school",
      audience: audienceToJson(trimmed.audience),
      approval_status: trimmed.approvalStatus ?? "draft",
      notify_on_publish: trimmed.notifyOnPublish ?? true,
      attendance_required: trimmed.attendanceRequired ?? false,
      recurrence_rule: trimmed.recurrenceRule || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("school_id", schoolId)
    .is("archived_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Event updated.", id: input.id };
}

export async function setCalendarEventApprovalAction(
  eventId: string,
  approvalStatus: CalendarEventApprovalStatus,
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { error } = await supabase
    .from("calendar_events")
    .update({
      approval_status: approvalStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .eq("school_id", schoolId)
    .is("archived_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/calendar");
  return {
    success: true,
    message: `Event marked ${approvalStatus}.`,
    id: eventId,
  };
}

export async function archiveCalendarEventAction(
  eventId: string,
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { error } = await supabase
    .from("calendar_events")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Event archived.", id: eventId };
}

export async function restoreCalendarEventAction(
  eventId: string,
): Promise<CalendarActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { error } = await supabase
    .from("calendar_events")
    .update({
      archived_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Event restored.", id: eventId };
}
