"use server";

import { assertYearOwned } from "@/lib/events/server-helpers";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listActivityEventsAction(input: {
  academicYearId: string;
  category?: string;
  houseId?: string;
  clubId?: string;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("engagement.event.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  let query = supabase
    .from("calendar_events")
    .select(
      "id, title, category, starts_at, ends_at, location, approval_status, house_id, club_id, attendance_required, certificate_enabled, attachment_media_ids, photo_media_ids",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .is("archived_at", null)
    .order("starts_at", { ascending: false })
    .limit(500);

  if (input.category) {
    query = query.eq("category", input.category);
  }
  if (input.houseId) {
    query = query.eq("house_id", input.houseId);
  }
  if (input.clubId) {
    query = query.eq("club_id", input.clubId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function getActivityEventDetailAction(eventId: string): Promise<
  | {
      success: true;
      event: Record<string, unknown>;
      staff: Array<Record<string, unknown>>;
      participants: Array<Record<string, unknown>>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("engagement.event.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: event } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", eventId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!event) {
    return { success: false, error: "Event not found." };
  }

  const [{ data: staff }, { data: participants }] = await Promise.all([
    supabase
      .from("event_staff_assignments")
      .select(
        "id, employment_id, role, remarks, created_at",
      )
      .eq("calendar_event_id", eventId)
      .is("archived_at", null),
    supabase
      .from("event_participants")
      .select(
        "id, student_profile_id, rsvp_status, participation_role, attendance_status, position_label, award_label, certificate_status, certificate_document_id, remarks, notes, attachment_media_ids, photo_media_ids",
      )
      .eq("calendar_event_id", eventId)
      .is("archived_at", null),
  ]);

  return {
    success: true,
    event,
    staff: staff ?? [],
    participants: participants ?? [],
  };
}

export async function listStudentEventParticipationsAction(input: {
  studentProfileId: string;
  academicYearId?: string;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("engagement.event.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: parts, error } = await supabase
    .from("event_participants")
    .select(
      "id, calendar_event_id, rsvp_status, participation_role, attendance_status, position_label, award_label, certificate_status, certificate_document_id, remarks, notes, created_at",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return { success: false, error: error.message };
  }

  const eventIds = [
    ...new Set((parts ?? []).map((p) => p.calendar_event_id as string)),
  ];
  if (!eventIds.length) {
    return { success: true, rows: [] };
  }

  let eventsQuery = supabase
    .from("calendar_events")
    .select(
      "id, title, category, starts_at, ends_at, location, approval_status, academic_year_id, house_id, club_id",
    )
    .in("id", eventIds)
    .is("archived_at", null);

  if (input.academicYearId) {
    eventsQuery = eventsQuery.eq("academic_year_id", input.academicYearId);
  }

  const { data: events } = await eventsQuery;
  const eventMap = new Map((events ?? []).map((e) => [e.id, e]));

  const rows = (parts ?? [])
    .filter((p) => eventMap.has(p.calendar_event_id as string))
    .map((p) => ({
      ...p,
      event: eventMap.get(p.calendar_event_id as string),
    }));

  return { success: true, rows };
}

export async function listEventActivityAuditAction(input: {
  calendarEventId?: string;
  studentProfileId?: string;
  limit?: number;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("engagement.event.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("event_activity_audit_log")
    .select(
      "id, action, actor_id, calendar_event_id, event_participant_id, employment_id, student_profile_id, old_values, new_values, created_at",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);

  if (input.calendarEventId) {
    query = query.eq("calendar_event_id", input.calendarEventId);
  }
  if (input.studentProfileId) {
    query = query.eq("student_profile_id", input.studentProfileId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}
