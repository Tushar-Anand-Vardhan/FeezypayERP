/**
 * Timetable Configuration Engine validation + conflict smoke tests (no DB).
 * Run: npx tsx scripts/smoke-timetable-validation.ts
 */
import assert from "node:assert/strict";
import {
  detectBatchSlotConflicts,
  detectSlotConflicts,
  timesOverlap,
  validateGridInput,
  validatePeriodInput,
  validatePeriodSet,
  validateSlotInput,
} from "../lib/timetable/validation";
import {
  applyTimetableCsv,
  buildTimetableCsvTemplateRows,
  parseTimetableDay,
  TIMETABLE_CSV_HEADERS,
} from "../lib/onboarding/timetable-csv";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("timesOverlap");
assert.equal(timesOverlap("08:00", "09:00", "08:30", "09:30"), true);
assert.equal(timesOverlap("08:00", "09:00", "09:00", "10:00"), false);
console.log("OK");

section("validatePeriodInput");
const periodBad = validatePeriodInput({
  academicYearId: "y1",
  periodNumber: 0,
  startTime: "10:00",
  endTime: "09:00",
});
assert.ok(periodBad.periodNumber);
assert.ok(periodBad.endTime);
console.log("OK");

section("validatePeriodSet overlap");
const overlaps = validatePeriodSet([
  {
    id: "1",
    periodNumber: 1,
    startTime: "08:00",
    endTime: "09:00",
  },
  {
    id: "2",
    periodNumber: 2,
    startTime: "08:30",
    endTime: "09:30",
  },
]);
assert.equal(overlaps.length, 1);
assert.equal(overlaps[0].kind, "period_overlap");
console.log("OK");

section("validateGridInput");
assert.ok(validateGridInput({ academicYearId: "", name: "" }).name);
assert.equal(
  Object.keys(
    validateGridInput({
      academicYearId: "y1",
      name: "Exam week",
      gridType: "exam",
      cycleLength: 5,
    }),
  ).length,
  0,
);
console.log("OK");

section("validateSlotInput");
assert.ok(
  validateSlotInput({
    sectionId: "",
    dayOfWeek: 9,
    periodDefinitionId: "p1",
  }).dayOfWeek,
);
console.log("OK");

section("detectSlotConflicts teacher double book");
const teacherConflicts = detectSlotConflicts({
  candidate: {
    sectionId: "s2",
    dayOfWeek: 1,
    periodDefinitionId: "p1",
    teacherId: "t1",
  },
  existing: [
    {
      id: "existing",
      sectionId: "s1",
      dayOfWeek: 1,
      periodDefinitionId: "p1",
      teacherId: "t1",
    },
  ],
  periods: [
    {
      id: "p1",
      periodNumber: 1,
      startTime: "08:00",
      endTime: "09:00",
    },
  ],
});
assert.ok(
  teacherConflicts.some((c) => c.kind === "teacher_double_booked"),
);
console.log("OK");

section("detectSlotConflicts teacher unavailable");
const unavailable = detectSlotConflicts({
  candidate: {
    sectionId: "s1",
    dayOfWeek: 2,
    periodDefinitionId: "p1",
    teacherId: "t1",
  },
  existing: [],
  periods: [
    {
      id: "p1",
      periodNumber: 1,
      startTime: "08:00",
      endTime: "09:00",
    },
  ],
  teacherBlocks: [
    { dayOfWeek: 2, periodDefinitionId: null, isAvailable: false },
  ],
});
assert.ok(unavailable.some((c) => c.kind === "teacher_unavailable"));
console.log("OK");

section("detectSlotConflicts period locked");
const locked = detectSlotConflicts({
  candidate: {
    sectionId: "s1",
    dayOfWeek: 1,
    periodDefinitionId: "p1",
  },
  existing: [],
  periods: [
    {
      id: "p1",
      periodNumber: 1,
      startTime: "08:00",
      endTime: "09:00",
      isLocked: true,
    },
  ],
});
assert.ok(locked.some((c) => c.kind === "period_locked"));
console.log("OK");

section("detectBatchSlotConflicts");
const batch = detectBatchSlotConflicts({
  candidates: [
    {
      sectionId: "s1",
      dayOfWeek: 1,
      periodDefinitionId: "p1",
      teacherId: "t1",
    },
    {
      sectionId: "s2",
      dayOfWeek: 1,
      periodDefinitionId: "p1",
      teacherId: "t1",
    },
  ],
  periods: [
    {
      id: "p1",
      periodNumber: 1,
      startTime: "08:00",
      endTime: "09:00",
    },
  ],
});
assert.ok(batch.some((c) => c.kind === "teacher_double_booked"));
console.log("OK");

section("onboarding timetable CSV");
assert.equal(parseTimetableDay("Monday"), 1);
assert.equal(parseTimetableDay("sat"), 6);
assert.equal(parseTimetableDay("Sun"), null);

const catalog = {
  section: { id: "sec-a", name: "A", className: "6" },
  periodNumbers: [1, 2],
  subjects: [{ id: "sub-math", name: "Mathematics" }],
  teachers: [
    { id: "emp-1", name: "Priya Sharma", employeeCode: "T001" },
    { id: "emp-2", name: "Raj Gupta", employeeCode: "T002" },
  ],
};

const good = applyTimetableCsv({
  csvText: `${TIMETABLE_CSV_HEADERS.join(",")}\n6,A,Mon,1,Mathematics,Priya Sharma\n6,A,Tue,1,Mathematics,T002`,
  catalog,
});
assert.equal(good.ok, true);
if (good.ok) {
  assert.equal(good.filledCount, 2);
  assert.equal(good.slots[0].teacherId, "emp-1");
  assert.equal(good.slots[1].teacherId, "emp-2");
}

const blocked = applyTimetableCsv({
  csvText: `${TIMETABLE_CSV_HEADERS.join(",")}\n6,B,Mon,1,Mathematics,Priya Sharma`,
  catalog,
});
assert.equal(blocked.ok, false);
if (!blocked.ok) {
  assert.ok(blocked.errors[0]?.includes("section"));
}

const unknown = applyTimetableCsv({
  csvText: `${TIMETABLE_CSV_HEADERS.join(",")}\n6,A,Mon,1,French,Priya Sharma`,
  catalog,
});
assert.equal(unknown.ok, false);

const duplicate = applyTimetableCsv({
  csvText: `${TIMETABLE_CSV_HEADERS.join(",")}\n6,A,Mon,1,Mathematics,Priya Sharma\n6,A,Monday,1,Mathematics,T002`,
  catalog,
});
assert.equal(duplicate.ok, false);
if (!duplicate.ok) {
  assert.ok(duplicate.errors.some((error) => error.includes("duplicate")));
}

const template = buildTimetableCsvTemplateRows({
  className: "6",
  sectionName: "A",
  periodCount: 2,
  sampleSubject: "Mathematics",
  sampleTeacher: "Priya Sharma",
});
assert.equal(template[0]?.[4], "Mathematics");
assert.equal(template.length, 12);
console.log("OK");

console.log("\nAll timetable validation checks passed.");
