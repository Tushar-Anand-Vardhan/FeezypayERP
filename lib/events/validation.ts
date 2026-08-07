import type {
  ActivityCategory,
  BulkParticipantsInput,
  CreateActivityEventInput,
  IssueCertificateInput,
  ParticipantUpsertInput,
  StaffAssignmentInput,
} from "@/lib/events/types";
import {
  ACTIVITY_CATEGORIES,
  CERTIFICATE_STATUSES,
  EVENT_ATTENDANCE_STATUSES,
  PARTICIPATION_ROLES,
  RSVP_STATUSES,
  STAFF_ASSIGNMENT_ROLES,
} from "@/lib/events/types";

export function isActivityCategory(value: string): value is ActivityCategory {
  return (ACTIVITY_CATEGORIES as string[]).includes(value);
}

export function validateCreateActivityEventInput(
  input: CreateActivityEventInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!input.title?.trim()) {
    errors.title = "Title is required.";
  }
  if (!isActivityCategory(input.category)) {
    errors.category = "Invalid activity category.";
  }
  if (!input.startsAt?.trim()) {
    errors.startsAt = "Start time is required.";
  }
  if (!input.endsAt?.trim()) {
    errors.endsAt = "End time is required.";
  }
  if (
    input.startsAt &&
    input.endsAt &&
    new Date(input.endsAt).getTime() < new Date(input.startsAt).getTime()
  ) {
    errors.endsAt = "End must be on or after start.";
  }
  if (input.category === "club_activity" && !input.clubId?.trim()) {
    errors.clubId = "Club is required for club activities.";
  }
  if (input.category === "house_activity" && !input.houseId?.trim()) {
    errors.houseId = "House is required for house activities.";
  }
  return errors;
}

export function validateStaffAssignmentInput(
  input: StaffAssignmentInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.calendarEventId?.trim()) {
    errors.calendarEventId = "Event is required.";
  }
  if (!input.employmentId?.trim()) {
    errors.employmentId = "Teacher employment is required.";
  }
  if (
    input.role &&
    !(STAFF_ASSIGNMENT_ROLES as string[]).includes(input.role)
  ) {
    errors.role = "Invalid staff role.";
  }
  return errors;
}

export function validateParticipantUpsertInput(
  input: ParticipantUpsertInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.calendarEventId?.trim()) {
    errors.calendarEventId = "Event is required.";
  }
  if (!input.studentProfileId?.trim()) {
    errors.studentProfileId = "Student is required.";
  }
  if (
    input.rsvpStatus &&
    !(RSVP_STATUSES as string[]).includes(input.rsvpStatus)
  ) {
    errors.rsvpStatus = "Invalid RSVP status.";
  }
  if (
    input.participationRole &&
    !(PARTICIPATION_ROLES as string[]).includes(input.participationRole)
  ) {
    errors.participationRole = "Invalid participation role.";
  }
  if (
    input.attendanceStatus &&
    !(EVENT_ATTENDANCE_STATUSES as string[]).includes(input.attendanceStatus)
  ) {
    errors.attendanceStatus = "Invalid attendance status.";
  }
  if (
    input.certificateStatus &&
    !(CERTIFICATE_STATUSES as string[]).includes(input.certificateStatus)
  ) {
    errors.certificateStatus = "Invalid certificate status.";
  }
  if (input.remarks && input.remarks.length > 4000) {
    errors.remarks = "Remarks are too long.";
  }
  return errors;
}

export function validateBulkParticipantsInput(
  input: BulkParticipantsInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.calendarEventId?.trim()) {
    errors.calendarEventId = "Event is required.";
  }
  if (!input.participants?.length) {
    errors.participants = "At least one participant is required.";
  } else {
    input.participants.forEach((p, i) => {
      if (!p.studentProfileId?.trim()) {
        errors[`participants.${i}.studentProfileId`] = "Student is required.";
      }
    });
  }
  return errors;
}

export function validateIssueCertificateInput(
  input: IssueCertificateInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.eventParticipantId?.trim()) {
    errors.eventParticipantId = "Participant id is required.";
  }
  return errors;
}
