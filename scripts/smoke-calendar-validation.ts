/**
 * Academic Calendar Engine validation smoke tests (no DB).
 * Run: npx tsx scripts/smoke-calendar-validation.ts
 */
import assert from "node:assert/strict";
import {
  isIsoDate,
  validateCalendarEventInput,
  validateHolidayInput,
  validateTermInput,
  validateWorkingDayPattern,
} from "../lib/calendar/validation";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

section("isIsoDate");
assert.equal(isIsoDate("2026-08-07"), true);
assert.equal(isIsoDate("2026-13-01"), false);
assert.equal(isIsoDate("07-08-2026"), false);
console.log("OK");

section("validateWorkingDayPattern");
const noDays = validateWorkingDayPattern({
  monday: false,
  tuesday: false,
  wednesday: false,
  thursday: false,
  friday: false,
  saturday: false,
  sunday: false,
});
assert.equal(noDays.form, "Select at least one working day.");
const okDays = validateWorkingDayPattern({
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
});
assert.equal(Object.keys(okDays).length, 0);
console.log("OK");

section("validateTermInput");
const termErrors = validateTermInput({
  academicYearId: "",
  name: "",
  startDate: "bad",
  endDate: "2026-01-01",
});
assert.ok(termErrors.academicYearId);
assert.ok(termErrors.name);
assert.ok(termErrors.startDate);
const termRange = validateTermInput({
  academicYearId: "y1",
  name: "Term 1",
  startDate: "2026-06-01",
  endDate: "2026-05-01",
});
assert.ok(termRange.endDate);
console.log("OK");

section("validateHolidayInput");
const holidayOk = validateHolidayInput({
  academicYearId: "y1",
  title: "Diwali",
  startDate: "2026-11-08",
  endDate: "2026-11-10",
});
assert.equal(Object.keys(holidayOk).length, 0);
const holidayBad = validateHolidayInput({
  academicYearId: "y1",
  title: "",
  startDate: "2026-11-10",
  endDate: "2026-11-08",
});
assert.ok(holidayBad.title);
assert.ok(holidayBad.endDate);
console.log("OK");

section("validateCalendarEventInput");
const eventOk = validateCalendarEventInput({
  academicYearId: "y1",
  title: "Parent Teacher Meeting",
  category: "ptm",
  startsAt: "2026-09-15T09:00:00.000Z",
  endsAt: "2026-09-15T13:00:00.000Z",
  visibility: "parents",
  approvalStatus: "draft",
});
assert.equal(Object.keys(eventOk).length, 0);

const eventBad = validateCalendarEventInput({
  academicYearId: "y1",
  title: "",
  category: "ptm",
  startsAt: "2026-09-15T13:00:00.000Z",
  endsAt: "2026-09-15T09:00:00.000Z",
});
assert.ok(eventBad.title);
assert.ok(eventBad.endsAt);

const eventCategory = validateCalendarEventInput({
  academicYearId: "y1",
  title: "X",
  // @ts-expect-error intentional invalid category
  category: "holiday",
  startsAt: "2026-09-15T09:00:00.000Z",
  endsAt: "2026-09-15T10:00:00.000Z",
});
assert.ok(eventCategory.category);
console.log("OK");

console.log("\nAll calendar validation checks passed.");
