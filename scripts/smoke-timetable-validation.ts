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
import {
  defaultDayStructure,
  resolvePeriodFromCsv,
  type PeriodFormRow,
} from "../lib/onboarding/timetable";

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
  periodNumber: -1,
  startTime: "10:00",
  endTime: "09:00",
});
assert.ok(periodBad.periodNumber);
assert.ok(periodBad.endTime);
assert.equal(
  Object.keys(
    validatePeriodInput({
      academicYearId: "y1",
      periodNumber: 0,
      startTime: "07:40",
      endTime: "08:00",
    }),
  ).length,
  0,
);
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

const dayStructure: PeriodFormRow[] = [
  {
    periodNumber: 0,
    name: "Class teacher",
    startTime: "07:40",
    endTime: "08:00",
    educational: true,
  },
  {
    periodNumber: 1,
    name: "Period 1",
    startTime: "08:00",
    endTime: "08:40",
    educational: true,
  },
  {
    periodNumber: 2,
    name: "Lunch",
    startTime: "08:40",
    endTime: "09:20",
    educational: false,
  },
  {
    periodNumber: 3,
    name: "Period 2",
    startTime: "09:20",
    endTime: "10:00",
    educational: true,
  },
];
assert.equal(resolvePeriodFromCsv("1", dayStructure)?.name, "Period 1");
assert.equal(resolvePeriodFromCsv("Period 2", dayStructure)?.periodNumber, 3);
assert.equal(resolvePeriodFromCsv("Lunch", dayStructure)?.educational, false);
assert.equal(defaultDayStructure().some((row) => !row.educational), true);

const catalog = {
  section: { id: "sec-a", name: "A", className: "6" },
  periods: dayStructure,
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

const aliasCatalog = {
  ...catalog,
  section: { ...catalog.section, className: "Class 6", name: "Rose" },
};
const classAlias = applyTimetableCsv({
  csvText: `${TIMETABLE_CSV_HEADERS.join(",")}\n6,ROSE,Mon,1,Mathematics,Priya Sharma`,
  catalog: aliasCatalog,
});
assert.equal(classAlias.ok, true);
if (classAlias.ok) {
  assert.equal(classAlias.filledCount, 1);
}

const wrongClass = applyTimetableCsv({
  csvText: `${TIMETABLE_CSV_HEADERS.join(",")}\n7,A,Mon,1,Mathematics,Priya Sharma`,
  catalog,
});
assert.equal(wrongClass.ok, false);
if (!wrongClass.ok) {
  assert.ok(wrongClass.errors[0]?.includes("class"));
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

const lunchBlocked = applyTimetableCsv({
  csvText: `${TIMETABLE_CSV_HEADERS.join(",")}\n6,A,Mon,Lunch,Mathematics,Priya Sharma`,
  catalog,
});
assert.equal(lunchBlocked.ok, false);

const lunchEmpty = applyTimetableCsv({
  csvText: `${TIMETABLE_CSV_HEADERS.join(",")}\n6,A,Mon,Lunch,,`,
  catalog,
});
assert.equal(lunchEmpty.ok, true);

const lunchDuty = applyTimetableCsv({
  csvText: `${TIMETABLE_CSV_HEADERS.join(",")}\n6,A,Mon,Lunch,,Priya Sharma`,
  catalog,
});
assert.equal(lunchDuty.ok, true);
if (lunchDuty.ok) {
  assert.equal(lunchDuty.slots[0]?.teacherId, "emp-1");
  assert.equal(lunchDuty.slots[0]?.subjectId, "");
}

const template = buildTimetableCsvTemplateRows({
  className: "6",
  sectionName: "A",
  periods: dayStructure,
  sampleSubject: "Mathematics",
  sampleTeacher: "Priya Sharma",
});
assert.equal(template[0]?.[3], "Class teacher");
assert.equal(template[0]?.[4], "07:40");
assert.equal(template[0]?.[6], "yes");
assert.equal(
  template.find((row) => row[2] === "Mon" && row[3] === "Period 1")?.[7],
  "Mathematics",
);
assert.equal(template.find((row) => row[3] === "Lunch")?.[6], "no");
assert.equal(template.length, 24);

const customTemplate = buildTimetableCsvTemplateRows({
  className: "8",
  sectionName: "B",
  periods: [
    {
      periodNumber: 0,
      name: "Zero",
      startTime: "07:30",
      endTime: "07:50",
      educational: true,
    },
    {
      periodNumber: 1,
      name: "Assembly",
      startTime: "07:50",
      endTime: "08:10",
      educational: false,
    },
  ],
});
assert.equal(customTemplate[0]?.[3], "Zero");
assert.equal(customTemplate[0]?.[4], "07:30");
assert.equal(customTemplate[6]?.[3], "Assembly");
assert.equal(customTemplate[6]?.[6], "no");
assert.equal(customTemplate.length, 12);
console.log("OK");

console.log("\nAll timetable validation checks passed.");
