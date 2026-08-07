"use server";

import { revalidatePath } from "next/cache";
import {
  assertEventOwned,
  getActorId,
  writeEventAudit,
} from "@/lib/events/server-helpers";
import type {
  EventActivityActionResult,
  IssueCertificateInput,
} from "@/lib/events/types";
import { validateIssueCertificateInput } from "@/lib/events/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/calendar");
}

/**
 * Issue a participation certificate as E20 student_issued_documents,
 * linked to the calendar event + participant (no event body copied onto student).
 */
export async function issueEventCertificateAction(
  input: IssueCertificateInput,
): Promise<EventActivityActionResult> {
  const context = await getAuthenticatedSchoolContext("engagement.event.create");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateIssueCertificateInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const { data: participant } = await supabase
    .from("event_participants")
    .select(
      "id, calendar_event_id, student_profile_id, certificate_status, certificate_document_id, position_label, award_label, archived_at",
    )
    .eq("id", input.eventParticipantId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!participant || participant.archived_at) {
    return { success: false, error: "Participant not found." };
  }

  const event = await assertEventOwned(
    supabase,
    schoolId,
    participant.calendar_event_id,
  );
  if (!event.ok) {
    return { success: false, error: "Event not found." };
  }

  const title =
    input.title?.trim() ||
    `Certificate — ${event.title}${
      participant.position_label || participant.award_label
        ? ` (${[participant.position_label, participant.award_label]
            .filter(Boolean)
            .join(", ")})`
        : ""
    }`;

  const issuedOn = input.issuedOn ?? new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  let documentId = participant.certificate_document_id as string | null;

  if (documentId) {
    await supabase
      .from("student_issued_documents")
      .update({
        title,
        status: "issued",
        issued_on: issuedOn,
        calendar_event_id: participant.calendar_event_id,
        event_participant_id: participant.id,
        academic_year_id: event.academicYearId ?? null,
        updated_at: now,
      })
      .eq("id", documentId);
  } else {
    const { data: doc, error } = await supabase
      .from("student_issued_documents")
      .insert({
        school_id: schoolId,
        student_profile_id: participant.student_profile_id,
        document_kind: "certificate",
        title,
        academic_year_id: event.academicYearId ?? null,
        issued_on: issuedOn,
        status: "issued",
        calendar_event_id: participant.calendar_event_id,
        event_participant_id: participant.id,
      })
      .select("id")
      .maybeSingle();

    if (error || !doc) {
      return {
        success: false,
        error: error?.message ?? "Failed to issue certificate.",
      };
    }
    documentId = doc.id;
  }

  const { error: partError } = await supabase
    .from("event_participants")
    .update({
      certificate_status: "issued",
      certificate_document_id: documentId,
      updated_at: now,
    })
    .eq("id", participant.id);

  if (partError) {
    return { success: false, error: partError.message };
  }

  await writeEventAudit(supabase, {
    schoolId,
    action: "certificate.issued",
    actorId,
    calendarEventId: participant.calendar_event_id,
    eventParticipantId: participant.id,
    studentProfileId: participant.student_profile_id,
    newValues: { document_id: documentId, title },
  });

  revalidate();
  return {
    success: true,
    message: "Certificate issued (linked to calendar event).",
    id: documentId ?? undefined,
  };
}
