import type {
  AvailabilityBlock,
  CycleDayInput,
  GridInput,
  PeriodConflictSnapshot,
  PeriodInput,
  SlotConflictCandidate,
  SlotInput,
  TeacherAvailabilityInput,
  SectionAvailabilityInput,
  TimetableConflict,
} from "@/lib/timetable/types";

const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isTime(value: string): boolean {
  if (!TIME_RE.test(value)) {
    return false;
  }
  const [h, m] = value.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function normalizeTime(value: string): string {
  return value.trim().slice(0, 5);
}

export function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const as = normalizeTime(aStart);
  const ae = normalizeTime(aEnd);
  const bs = normalizeTime(bStart);
  const be = normalizeTime(bEnd);
  return as < be && bs < ae;
}

export function trimPeriodInput(input: PeriodInput): PeriodInput {
  return {
    id: input.id,
    academicYearId: input.academicYearId.trim(),
    periodNumber: input.periodNumber,
    startTime: normalizeTime(input.startTime),
    endTime: normalizeTime(input.endTime),
    name: input.name?.trim() ?? "",
    isBreak: input.isBreak ?? false,
  };
}

export function validatePeriodInput(input: PeriodInput): Record<string, string> {
  const trimmed = trimPeriodInput(input);
  const errors: Record<string, string> = {};
  if (!trimmed.academicYearId) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!Number.isInteger(trimmed.periodNumber) || trimmed.periodNumber < 1) {
    errors.periodNumber = "Period number must be a positive integer.";
  }
  if (!isTime(trimmed.startTime)) {
    errors.startTime = "Start time must be HH:MM.";
  }
  if (!isTime(trimmed.endTime)) {
    errors.endTime = "End time must be HH:MM.";
  }
  if (
    isTime(trimmed.startTime) &&
    isTime(trimmed.endTime) &&
    trimmed.endTime <= trimmed.startTime
  ) {
    errors.endTime = "End time must be after start time.";
  }
  return errors;
}

export function validatePeriodSet(
  periods: PeriodConflictSnapshot[],
): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];
  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      const a = periods[i];
      const b = periods[j];
      if (
        timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime) &&
        !a.isBreak &&
        !b.isBreak
      ) {
        conflicts.push({
          kind: "period_overlap",
          message: `Period ${a.periodNumber} overlaps period ${b.periodNumber}.`,
        });
      }
    }
  }
  return conflicts;
}

export function validateGridInput(input: GridInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (!input.name?.trim()) {
    errors.name = "Grid name is required.";
  }
  const cycle = input.cycleLength ?? 6;
  if (cycle < 1 || cycle > 14) {
    errors.cycleLength = "Cycle length must be 1–14.";
  }
  const type = input.gridType ?? "primary";
  if (!["primary", "alternate", "exam", "special"].includes(type)) {
    errors.gridType = "Invalid grid type.";
  }
  if (input.effectiveFrom && !DATE_RE.test(input.effectiveFrom)) {
    errors.effectiveFrom = "Use YYYY-MM-DD.";
  }
  if (input.effectiveTo && !DATE_RE.test(input.effectiveTo)) {
    errors.effectiveTo = "Use YYYY-MM-DD.";
  }
  if (
    input.effectiveFrom &&
    input.effectiveTo &&
    DATE_RE.test(input.effectiveFrom) &&
    DATE_RE.test(input.effectiveTo) &&
    input.effectiveTo < input.effectiveFrom
  ) {
    errors.effectiveTo = "End date cannot be before start.";
  }
  return errors;
}

export function validateCycleDayInput(
  input: CycleDayInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.gridId?.trim()) {
    errors.gridId = "Grid is required.";
  }
  if (!input.label?.trim()) {
    errors.label = "Label is required.";
  }
  if (!Number.isInteger(input.dayIndex) || input.dayIndex < 1) {
    errors.dayIndex = "Day index must be ≥ 1.";
  }
  if (
    input.mapsToWeekday != null &&
    (input.mapsToWeekday < 1 || input.mapsToWeekday > 7)
  ) {
    errors.mapsToWeekday = "Weekday must be 1–7.";
  }
  return errors;
}

export function validateSlotInput(input: SlotInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.sectionId?.trim()) {
    errors.sectionId = "Section is required.";
  }
  if (!input.periodDefinitionId?.trim()) {
    errors.periodDefinitionId = "Period is required.";
  }
  if (
    !Number.isInteger(input.dayOfWeek) ||
    input.dayOfWeek < 1 ||
    input.dayOfWeek > 7
  ) {
    errors.dayOfWeek = "Day of week must be 1–7.";
  }
  return errors;
}

function availabilityErrors(
  input: AvailabilityInputLike,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.academicYearId?.trim()) {
    errors.academicYearId = "Academic year is required.";
  }
  if (
    !Number.isInteger(input.dayOfWeek) ||
    input.dayOfWeek < 1 ||
    input.dayOfWeek > 7
  ) {
    errors.dayOfWeek = "Day of week must be 1–7.";
  }
  return errors;
}

type AvailabilityInputLike = {
  academicYearId: string;
  dayOfWeek: number;
};

export function validateTeacherAvailabilityInput(
  input: TeacherAvailabilityInput,
): Record<string, string> {
  const errors = availabilityErrors(input);
  if (!input.employmentId?.trim()) {
    errors.employmentId = "Employment is required.";
  }
  return errors;
}

export function validateSectionAvailabilityInput(
  input: SectionAvailabilityInput,
): Record<string, string> {
  const errors = availabilityErrors(input);
  if (!input.sectionId?.trim()) {
    errors.sectionId = "Section is required.";
  }
  return errors;
}

function isBlocked(
  blocks: AvailabilityBlock[],
  dayOfWeek: number,
  periodId: string,
): boolean {
  return blocks.some(
    (b) =>
      b.dayOfWeek === dayOfWeek &&
      b.isAvailable === false &&
      (b.periodDefinitionId == null || b.periodDefinitionId === periodId),
  );
}

/**
 * Pure conflict detector for scheduling a candidate slot against existing slots.
 */
export function detectSlotConflicts(input: {
  candidate: SlotConflictCandidate;
  existing: SlotConflictCandidate[];
  periods: PeriodConflictSnapshot[];
  teacherBlocks?: AvailabilityBlock[];
  sectionBlocks?: AvailabilityBlock[];
}): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];
  const { candidate, existing, periods } = input;
  const period = periods.find((p) => p.id === candidate.periodDefinitionId);
  const slotKey = `${candidate.sectionId}:${candidate.dayOfWeek}:${candidate.periodDefinitionId}`;

  if (period?.isLocked) {
    conflicts.push({
      kind: "period_locked",
      message: `Period ${period.periodNumber} is locked.`,
      slotKey,
    });
  }

  if (period?.isBreak) {
    conflicts.push({
      kind: "break_period",
      message: `Period ${period.periodNumber} is a break and cannot hold a class.`,
      slotKey,
    });
  }

  if (candidate.isLocked) {
    conflicts.push({
      kind: "slot_locked",
      message: "This slot is locked.",
      slotKey,
    });
  }

  if (
    candidate.teacherId &&
    input.teacherBlocks &&
    isBlocked(input.teacherBlocks, candidate.dayOfWeek, candidate.periodDefinitionId)
  ) {
    conflicts.push({
      kind: "teacher_unavailable",
      message: "Teacher is marked unavailable for this period.",
      slotKey,
    });
  }

  if (
    input.sectionBlocks &&
    isBlocked(input.sectionBlocks, candidate.dayOfWeek, candidate.periodDefinitionId)
  ) {
    conflicts.push({
      kind: "section_unavailable",
      message: "Section is marked unavailable for this period.",
      slotKey,
    });
  }

  for (const other of existing) {
    if (candidate.id && other.id && candidate.id === other.id) {
      continue;
    }
    const sameGrid =
      (candidate.gridId ?? null) === (other.gridId ?? null);
    if (!sameGrid) {
      continue;
    }
    if (candidate.dayOfWeek !== other.dayOfWeek) {
      continue;
    }
    if (candidate.periodDefinitionId !== other.periodDefinitionId) {
      continue;
    }

    if (candidate.sectionId === other.sectionId) {
      conflicts.push({
        kind: "section_double_booked",
        message: "Section already has a class in this period.",
        slotKey,
      });
    }

    if (
      candidate.teacherId &&
      other.teacherId &&
      candidate.teacherId === other.teacherId
    ) {
      conflicts.push({
        kind: "teacher_double_booked",
        message: "Teacher is already allocated to another section in this period.",
        slotKey,
      });
    }

    if (
      candidate.roomId &&
      other.roomId &&
      candidate.roomId === other.roomId
    ) {
      conflicts.push({
        kind: "room_double_booked",
        message: "Room is already allocated in this period.",
        slotKey,
      });
    }
  }

  return conflicts;
}

export function detectBatchSlotConflicts(input: {
  candidates: SlotConflictCandidate[];
  periods: PeriodConflictSnapshot[];
  teacherBlocks?: AvailabilityBlock[];
  sectionBlocksBySection?: Record<string, AvailabilityBlock[]>;
}): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];
  const placed: SlotConflictCandidate[] = [];

  for (const candidate of input.candidates) {
    const sectionBlocks =
      input.sectionBlocksBySection?.[candidate.sectionId] ?? [];
    conflicts.push(
      ...detectSlotConflicts({
        candidate,
        existing: placed,
        periods: input.periods,
        teacherBlocks: input.teacherBlocks,
        sectionBlocks,
      }),
    );
    placed.push(candidate);
  }

  return conflicts;
}
