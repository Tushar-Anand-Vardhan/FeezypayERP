"use server";

import { revalidatePath } from "next/cache";
import {
  assertEmploymentOwned,
  assertEventOwned,
  assertStudentInSchool,
  getActorId,
  syncCompetitionProjection,
  writeEventAudit,
} from "@/lib/events/server-helpers";
import type {
  BulkParticipantsInput,
  EventActivityActionResult,
  ParticipantUpsertInput,
} from "@/lib/events/types";
import {
  validateBulkParticipantsInput,
  validateParticipantUpsertInput,
} from "@/lib/events/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/teacher");
}

async function upsertOneParticipant(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  schoolId: string,
  actorId: string | null,
  event: {
    category: string;
    title: string;
    academicYearId?: string;
  },
  input: ParticipantUpsertInput,
): Promise<{ id: string } | { error: string }> {
  const { data: existing } = await supabase
    .from("event_participants")
    .select("id")
    .eq("calendar_event_id", input.calendarEventId)
    .eq("student_profile_id", input.studentProfileId)
    .is("archived_at", null)
    .maybeSingle();

  const row = {
    school_id: schoolId,
    calendar_event_id: input.calendarEventId,
    student_profile_id: input.studentProfileId,
    rsvp_status: input.rsvpStatus ?? "invited",
    participation_role: input.participationRole ?? "participant",
    attendance_status: input.attendanceStatus ?? null,
    position_label: input.positionLabel ?? null,
    award_label: input.awardLabel ?? null,
    certificate_status: input.certificateStatus ?? "none",
    remarks: input.remarks ?? null,
    notes: input.notes ?? null,
    attachment_media_ids: input.attachmentMediaIds ?? [],
    photo_media_ids: input.photoMediaIds ?? [],
    recorded_by: actorId,
    recorded_by_employment_id: input.employmentId ?? null,
    updated_at: new Date().toISOString(),
  };

  let participantId: string;
  if (existing) {
    const { data: updated, error } = await supabase
      .from("event_participants")
      .update(row)
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();
    if (error || !updated) {
      return { error: error?.message ?? "Failed to update participant." };
    }
    participantId = updated.id;
  } else {
    const { data: inserted, error } = await supabase
      .from("event_participants")
      .insert(row)
      .select("id")
      .maybeSingle();
    if (error || !inserted) {
      return { error: error?.message ?? "Failed to add participant." };
    }
    participantId = inserted.id;
  }

  await syncCompetitionProjection(supabase, {
    schoolId,
    eventId: input.calendarEventId,
    eventTitle: event.title,
    eventCategory: event.category,
    studentProfileId: input.studentProfileId,
    eventParticipantId: participantId,
    role: input.participationRole ?? "participant",
    positionLabel: input.positionLabel,
    awardLabel: input.awardLabel,
    participatedOn: new Date().toISOString().slice(0, 10),
  });

  // E35 permanent profile projection (idempotent; no event SoT duplication)
  try {
    const { upsertAchievementFromParticipant } = await import(
      "@/lib/achievements/server-helpers"
    );
    await upsertAchievementFromParticipant(supabase, {
      schoolId,
      actorId,
      eventParticipantId: participantId,
      employmentId: input.employmentId,
    });
  } catch {
    // Non-fatal: achievement sync must not block event participation
  }

  return { id: participantId };
}

export async function upsertEventParticipantAction(
  input: ParticipantUpsertInput,
): Promise<EventActivityActionResult> {
  const context = await getAuthenticatedSchoolContext("engagement.event.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateParticipantUpsertInput(input);
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
    !(await assertStudentInSchool(supabase, schoolId, input.studentProfileId))
  ) {
    return { success: false, error: "Student not found in this school." };
  }
  if (
    input.employmentId &&
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const result = await upsertOneParticipant(supabase, schoolId, actorId, {
    category: event.category!,
    title: event.title!,
    academicYearId: event.academicYearId,
  }, input);

  if ("error" in result) {
    return { success: false, error: result.error };
  }

  await writeEventAudit(supabase, {
    schoolId,
    action: "participant.upserted",
    actorId,
    calendarEventId: input.calendarEventId,
    eventParticipantId: result.id,
    studentProfileId: input.studentProfileId,
    newValues: {
      attendance_status: input.attendanceStatus,
      award_label: input.awardLabel,
      position_label: input.positionLabel,
    },
  });

  revalidate();
  return {
    success: true,
    message: "Participant saved (linked to calendar event).",
    id: result.id,
  };
}

export async function bulkUpsertEventParticipantsAction(
  input: BulkParticipantsInput,
): Promise<EventActivityActionResult> {
  const context = await getAuthenticatedSchoolContext("engagement.event.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateBulkParticipantsInput(input);
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
    input.employmentId &&
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const ids: string[] = [];
  for (const p of input.participants) {
    if (
      !(await assertStudentInSchool(supabase, schoolId, p.studentProfileId))
    ) {
      return {
        success: false,
        error: `Student ${p.studentProfileId} not found.`,
      };
    }
    const result = await upsertOneParticipant(
      supabase,
      schoolId,
      actorId,
      {
        category: event.category!,
        title: event.title!,
        academicYearId: event.academicYearId,
      },
      {
        calendarEventId: input.calendarEventId,
        studentProfileId: p.studentProfileId,
        rsvpStatus: p.rsvpStatus,
        participationRole: p.participationRole,
        attendanceStatus: p.attendanceStatus,
        positionLabel: p.positionLabel,
        awardLabel: p.awardLabel,
        remarks: p.remarks,
        employmentId: input.employmentId,
      },
    );
    if ("error" in result) {
      return { success: false, error: result.error };
    }
    ids.push(result.id);
  }

  await writeEventAudit(supabase, {
    schoolId,
    action: "participant.bulk_upserted",
    actorId,
    calendarEventId: input.calendarEventId,
    newValues: { count: ids.length },
  });

  revalidate();
  return {
    success: true,
    message: `Saved ${ids.length} participant(s).`,
    ids,
  };
}

export async function archiveEventParticipantAction(
  participantId: string,
): Promise<EventActivityActionResult> {
  const context = await getAuthenticatedSchoolContext("engagement.event.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data } = await supabase
    .from("event_participants")
    .select("id, calendar_event_id, student_profile_id")
    .eq("id", participantId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!data) {
    return { success: false, error: "Participant not found." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("event_participants")
    .update({ archived_at: now, updated_at: now })
    .eq("id", participantId);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase
    .from("competition_participations")
    .update({ archived_at: now, updated_at: now })
    .eq("event_participant_id", participantId);

  await writeEventAudit(supabase, {
    schoolId,
    action: "participant.archived",
    actorId,
    calendarEventId: data.calendar_event_id,
    eventParticipantId: participantId,
    studentProfileId: data.student_profile_id,
  });

  revalidate();
  return { success: true, message: "Participant archived.", id: participantId };
}
