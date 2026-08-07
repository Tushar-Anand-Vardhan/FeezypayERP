/** Timetable Configuration Engine (E10) types. */

export type TimetableActionResult =
  | { success: true; message: string; id?: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string>;
      conflicts?: TimetableConflict[];
    };

export type TimetableGridType = "primary" | "alternate" | "exam" | "special";

export type TimetableConflictKind =
  | "teacher_double_booked"
  | "section_double_booked"
  | "room_double_booked"
  | "teacher_unavailable"
  | "section_unavailable"
  | "period_locked"
  | "slot_locked"
  | "period_overlap"
  | "break_period";

export type TimetableConflict = {
  kind: TimetableConflictKind;
  message: string;
  slotKey?: string;
};

export type PeriodInput = {
  id?: string;
  academicYearId: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  name?: string;
  isBreak?: boolean;
};

export type GridInput = {
  id?: string;
  academicYearId: string;
  name: string;
  gridType?: TimetableGridType;
  cycleLength?: number;
  isActive?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

export type CycleDayInput = {
  gridId: string;
  dayIndex: number;
  label: string;
  mapsToWeekday?: number | null;
};

export type SlotInput = {
  id?: string;
  gridId?: string | null;
  sectionId: string;
  dayOfWeek: number;
  periodDefinitionId: string;
  subjectId?: string | null;
  teacherId?: string | null;
  roomId?: string | null;
  cycleDayId?: string | null;
};

export type AvailabilityInput = {
  academicYearId: string;
  dayOfWeek: number;
  periodDefinitionId?: string | null;
  isAvailable: boolean;
  notes?: string;
};

export type TeacherAvailabilityInput = AvailabilityInput & {
  employmentId: string;
};

export type SectionAvailabilityInput = AvailabilityInput & {
  sectionId: string;
};

/** Snapshot used by pure conflict detector. */
export type SlotConflictCandidate = {
  id?: string;
  gridId?: string | null;
  sectionId: string;
  dayOfWeek: number;
  periodDefinitionId: string;
  subjectId?: string | null;
  teacherId?: string | null;
  roomId?: string | null;
  isLocked?: boolean;
};

export type PeriodConflictSnapshot = {
  id: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
  isLocked?: boolean;
};

export type AvailabilityBlock = {
  dayOfWeek: number;
  periodDefinitionId: string | null;
  isAvailable: boolean;
};
