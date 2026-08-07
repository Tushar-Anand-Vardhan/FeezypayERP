/** Academic Calendar Engine (E08 + E17 scheduling surface) types. */

export type CalendarActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type AcademicYearStatus = "draft" | "active" | "closed";

export type CalendarEventCategory =
  | "ptm"
  | "competition"
  | "sports"
  | "trip"
  | "assembly"
  | "workshop"
  | "teacher_meeting"
  | "annual_day"
  | "custom";

export type CalendarEventVisibility =
  | "school"
  | "staff"
  | "students"
  | "parents"
  | "custom";

export type CalendarEventApprovalStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "published"
  | "cancelled"
  | "completed";

export type EventAudience = {
  classIds?: string[];
  sectionIds?: string[];
  roleKeys?: string[];
};

export type WorkingDayPatternInput = {
  academicYearId?: string | null;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
};

export type TermInput = {
  id?: string;
  academicYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  startMonth?: number | null;
  startDay?: number | null;
  endMonth?: number | null;
  endDay?: number | null;
};

export type HolidayInput = {
  id?: string;
  academicYearId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  isAllDay?: boolean;
};

export type CalendarEventInput = {
  id?: string;
  academicYearId: string;
  termId?: string | null;
  title: string;
  description?: string;
  category: CalendarEventCategory;
  startsAt: string;
  endsAt: string;
  isAllDay?: boolean;
  location?: string;
  visibility?: CalendarEventVisibility;
  audience?: EventAudience;
  approvalStatus?: CalendarEventApprovalStatus;
  notifyOnPublish?: boolean;
  attendanceRequired?: boolean;
  recurrenceRule?: string | null;
};

export const CALENDAR_EVENT_CATEGORIES: CalendarEventCategory[] = [
  "ptm",
  "competition",
  "sports",
  "trip",
  "assembly",
  "workshop",
  "teacher_meeting",
  "annual_day",
  "custom",
];

export const CALENDAR_EVENT_CATEGORY_LABELS: Record<
  CalendarEventCategory,
  string
> = {
  ptm: "PTM",
  competition: "Competition",
  sports: "Sports",
  trip: "Trip",
  assembly: "Assembly",
  workshop: "Workshop",
  teacher_meeting: "Teacher meeting",
  annual_day: "Annual day",
  custom: "Custom event",
};
