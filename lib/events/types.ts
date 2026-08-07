/** Event & Activity Engine (E17 ops) — types. */

export type EventActivityActionResult =
  | { success: true; message: string; id?: string; ids?: string[] }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

/** Activity categories that must exist as calendar_events.category */
export type ActivityCategory =
  | "sports"
  | "competition"
  | "assembly"
  | "trip"
  | "workshop"
  | "club_activity"
  | "house_activity"
  | "cultural"
  | "ptm"
  | "teacher_meeting"
  | "annual_day"
  | "custom";

export type StaffAssignmentRole =
  | "in_charge"
  | "assistant"
  | "coach"
  | "judge"
  | "escort"
  | "other";

export type ParticipationRole =
  | "participant"
  | "captain"
  | "volunteer"
  | "spectator"
  | "organizer_student"
  | "other";

export type EventAttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "excused"
  | "no_show";

export type RsvpStatus =
  | "invited"
  | "accepted"
  | "declined"
  | "attended"
  | "no_show";

export type CertificateStatus = "none" | "pending" | "issued" | "revoked";

export type CreateActivityEventInput = {
  academicYearId: string;
  termId?: string | null;
  title: string;
  description?: string;
  category: ActivityCategory;
  startsAt: string;
  endsAt: string;
  isAllDay?: boolean;
  location?: string;
  houseId?: string | null;
  clubId?: string | null;
  attendanceRequired?: boolean;
  certificateEnabled?: boolean;
  attachmentMediaIds?: string[];
  photoMediaIds?: string[];
  approvalStatus?: "draft" | "pending" | "approved" | "published";
};

export type StaffAssignmentInput = {
  calendarEventId: string;
  employmentId: string;
  role?: StaffAssignmentRole;
  remarks?: string | null;
};

export type ParticipantUpsertInput = {
  calendarEventId: string;
  studentProfileId: string;
  rsvpStatus?: RsvpStatus;
  participationRole?: ParticipationRole;
  attendanceStatus?: EventAttendanceStatus | null;
  positionLabel?: string | null;
  awardLabel?: string | null;
  certificateStatus?: CertificateStatus;
  remarks?: string | null;
  notes?: string | null;
  attachmentMediaIds?: string[];
  photoMediaIds?: string[];
  employmentId?: string | null;
};

export type BulkParticipantsInput = {
  calendarEventId: string;
  employmentId?: string | null;
  participants: Array<{
    studentProfileId: string;
    rsvpStatus?: RsvpStatus;
    participationRole?: ParticipationRole;
    attendanceStatus?: EventAttendanceStatus | null;
    positionLabel?: string | null;
    awardLabel?: string | null;
    remarks?: string | null;
  }>;
};

export type IssueCertificateInput = {
  eventParticipantId: string;
  title?: string;
  issuedOn?: string;
};

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  "sports",
  "competition",
  "assembly",
  "trip",
  "workshop",
  "club_activity",
  "house_activity",
  "cultural",
  "ptm",
  "teacher_meeting",
  "annual_day",
  "custom",
];

export const STAFF_ASSIGNMENT_ROLES: StaffAssignmentRole[] = [
  "in_charge",
  "assistant",
  "coach",
  "judge",
  "escort",
  "other",
];

export const PARTICIPATION_ROLES: ParticipationRole[] = [
  "participant",
  "captain",
  "volunteer",
  "spectator",
  "organizer_student",
  "other",
];

export const EVENT_ATTENDANCE_STATUSES: EventAttendanceStatus[] = [
  "present",
  "absent",
  "late",
  "excused",
  "no_show",
];

export const RSVP_STATUSES: RsvpStatus[] = [
  "invited",
  "accepted",
  "declined",
  "attended",
  "no_show",
];

export const CERTIFICATE_STATUSES: CertificateStatus[] = [
  "none",
  "pending",
  "issued",
  "revoked",
];
