"use server";

import { loadAchievement } from "@/lib/achievements/server-helpers";
import type { ListAchievementsFilter } from "@/lib/achievements/types";
import { validateListFilter } from "@/lib/achievements/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

const SELECT_COLS =
  "id, title, category, awarded_on, description, academic_year_id, term_id, source, calendar_event_id, event_participant_id, participation_role, attendance_status, award_label, position_label, certificate_status, certificate_document_id, points, remarks, photo_media_ids, attachment_media_ids, visibility, visible_to_guardians, visible_to_students, recorded_by_employment_id, archived_at, created_at, updated_at";

export async function listStudentAchievementsAction(
  input: ListAchievementsFilter = {},
): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string; fieldErrors?: Record<string, string> }
> {
  const context = await getAuthenticatedSchoolContext(
    "student_achievement.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateListFilter(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("student_achievements")
    .select(SELECT_COLS)
    .eq("school_id", schoolId)
    .order("awarded_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.min(input.limit ?? 200, 500));

  if (!input.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (input.studentProfileId) {
    query = query.eq("student_profile_id", input.studentProfileId);
  }
  if (input.academicYearId) {
    query = query.eq("academic_year_id", input.academicYearId);
  }
  if (input.calendarEventId) {
    query = query.eq("calendar_event_id", input.calendarEventId);
  }
  if (input.category) {
    query = query.eq("category", input.category);
  }
  if (input.source) {
    query = query.eq("source", input.source);
  }
  if (input.visibility) {
    query = query.eq("visibility", input.visibility);
  }
  if (input.awardedOnFrom) {
    query = query.gte("awarded_on", input.awardedOnFrom);
  }
  if (input.awardedOnTo) {
    query = query.lte("awarded_on", input.awardedOnTo);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

/**
 * Timeline for Student Profile — achievements with live calendar event join
 * (title/dates from calendar; outcomes from achievement row).
 */
export async function listStudentAchievementTimelineAction(input: {
  studentProfileId: string;
  academicYearId?: string;
  limit?: number;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "student_achievement.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  if (!input.studentProfileId?.trim()) {
    return { success: false, error: "Student is required." };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("student_achievements")
    .select(
      `${SELECT_COLS}, calendar_events ( id, title, category, starts_at, ends_at, location )`,
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .is("archived_at", null)
    .order("awarded_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.min(input.limit ?? 100, 300));

  if (input.academicYearId) {
    query = query.eq("academic_year_id", input.academicYearId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  const rows = (data ?? []).map((r) => {
    const raw = r.calendar_events as unknown;
    const event = Array.isArray(raw)
      ? (raw[0] as
          | {
              id: string;
              title: string;
              category: string;
              starts_at: string;
              ends_at: string;
              location: string | null;
            }
          | undefined)
      : (raw as
          | {
              id: string;
              title: string;
              category: string;
              starts_at: string;
              ends_at: string;
              location: string | null;
            }
          | null
          | undefined);
    const { calendar_events: _ignored, ...rest } = r as Record<
      string,
      unknown
    > & { calendar_events?: unknown };
    void _ignored;
    return {
      ...rest,
      event: event
        ? {
            id: event.id,
            title: event.title,
            category: event.category,
            startsAt: event.starts_at,
            endsAt: event.ends_at,
            location: event.location,
          }
        : null,
      timelineAt: (r.awarded_on as string | null) ?? (r.created_at as string),
    };
  });

  return { success: true, rows };
}

export async function getStudentAchievementAction(
  achievementId: string,
): Promise<
  | { success: true; achievement: Record<string, unknown> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "student_achievement.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const row = await loadAchievement(supabase, schoolId, achievementId);
  if (!row) {
    return { success: false, error: "Achievement not found." };
  }
  return { success: true, achievement: row };
}

export async function listAchievementAuditAction(input?: {
  studentProfileId?: string;
  limit?: number;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "student_achievement.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("student_achievement_audit_log")
    .select(
      "id, action, actor_id, achievement_id, student_profile_id, calendar_event_id, old_values, new_values, created_at",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(Math.min(input?.limit ?? 100, 500));

  if (input?.studentProfileId) {
    query = query.eq("student_profile_id", input.studentProfileId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}
