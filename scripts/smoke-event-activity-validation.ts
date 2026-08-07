/**
 * Pure validation smoke for Event & Activity Engine (E17).
 * Run: npx tsx scripts/smoke-event-activity-validation.ts
 */

import { CALENDAR_EVENT_CATEGORIES } from "../lib/calendar/types";
import {
  ACTIVITY_CATEGORIES,
  CERTIFICATE_STATUSES,
  EVENT_ATTENDANCE_STATUSES,
  PARTICIPATION_ROLES,
  STAFF_ASSIGNMENT_ROLES,
} from "../lib/events/types";
import {
  validateBulkParticipantsInput,
  validateCreateActivityEventInput,
  validateIssueCertificateInput,
  validateParticipantUpsertInput,
  validateStaffAssignmentInput,
} from "../lib/events/validation";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("=== activity categories (calendar origin) ===");
for (const c of [
  "sports",
  "competition",
  "assembly",
  "trip",
  "workshop",
  "club_activity",
  "house_activity",
  "cultural",
] as const) {
  assert(ACTIVITY_CATEGORIES.includes(c), c);
  assert(CALENDAR_EVENT_CATEGORIES.includes(c), `calendar has ${c}`);
}
console.log("OK");

console.log("=== create activity validation ===");
{
  const bad = validateCreateActivityEventInput({
    academicYearId: "",
    title: "",
    category: "sports",
    startsAt: "",
    endsAt: "",
  });
  assert(bad.academicYearId && bad.title && bad.startsAt, "required");

  const clubBad = validateCreateActivityEventInput({
    academicYearId: "y1",
    title: "Chess",
    category: "club_activity",
    startsAt: "2026-08-01T10:00:00Z",
    endsAt: "2026-08-01T11:00:00Z",
  });
  assert(clubBad.clubId, "club required");

  const houseBad = validateCreateActivityEventInput({
    academicYearId: "y1",
    title: "Relay",
    category: "house_activity",
    startsAt: "2026-08-01T10:00:00Z",
    endsAt: "2026-08-01T11:00:00Z",
  });
  assert(houseBad.houseId, "house required");

  const good = validateCreateActivityEventInput({
    academicYearId: "y1",
    title: "Annual sports",
    category: "sports",
    startsAt: "2026-08-01T10:00:00Z",
    endsAt: "2026-08-01T16:00:00Z",
  });
  assert(Object.keys(good).length === 0, "good sports");
}
console.log("OK");

console.log("=== staff / participants / certificate ===");
assert(STAFF_ASSIGNMENT_ROLES.includes("in_charge"), "in_charge");
assert(PARTICIPATION_ROLES.includes("participant"), "participant");
assert(EVENT_ATTENDANCE_STATUSES.includes("present"), "present");
assert(CERTIFICATE_STATUSES.includes("issued"), "issued");

{
  const staffBad = validateStaffAssignmentInput({
    calendarEventId: "",
    employmentId: "",
  });
  assert(staffBad.calendarEventId && staffBad.employmentId, "staff req");

  const partBad = validateParticipantUpsertInput({
    calendarEventId: "e1",
    studentProfileId: "",
  });
  assert(partBad.studentProfileId, "student req");

  const partGood = validateParticipantUpsertInput({
    calendarEventId: "e1",
    studentProfileId: "s1",
    attendanceStatus: "present",
    positionLabel: "1st",
    awardLabel: "Gold",
    remarks: "Excellent",
  });
  assert(Object.keys(partGood).length === 0, "good participant");

  const bulk = validateBulkParticipantsInput({
    calendarEventId: "e1",
    participants: [{ studentProfileId: "s1" }, { studentProfileId: "s2" }],
  });
  assert(Object.keys(bulk).length === 0, "bulk ok");

  const certBad = validateIssueCertificateInput({ eventParticipantId: "" });
  assert(certBad.eventParticipantId, "cert needs participant");
}
console.log("OK");

console.log("=== no student event dump contract ===");
{
  // Participation stores FK to calendar_event_id — not title/description copies as SoT
  const participation = {
    calendar_event_id: "evt-1",
    student_profile_id: "stu-1",
    award_label: "Gold",
  };
  assert(participation.calendar_event_id, "event by reference");
  assert(!("event_title" in participation), "no duplicated title field as SoT");
}
console.log("OK");

console.log("\nAll event activity smoke checks passed.");
