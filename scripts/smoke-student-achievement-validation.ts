/**
 * Student Achievement Engine (E35) validation smoke.
 * Run: npx tsx scripts/smoke-student-achievement-validation.ts
 */

import { PERMISSION_KEYS } from "../lib/authz/catalog";
import { SYSTEM_ROLE_BUNDLES } from "../lib/authz/bundles";
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_SOURCES,
  ACHIEVEMENT_VISIBILITIES,
} from "../lib/achievements/types";
import {
  mustNotDuplicateEventSot,
  validateListFilter,
  validateManualAchievementInput,
  validateQueueAiSummaryInput,
  validateRecordFromEventInput,
  visibilityFlags,
} from "../lib/achievements/validation";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("=== AuthZ keys + teacher record ===");
assert(
  PERMISSION_KEYS.includes("student_achievement.record"),
  "record key",
);
assert(
  SYSTEM_ROLE_BUNDLES.teacher.includes("student_achievement.record"),
  "teacher record",
);
assert(
  !SYSTEM_ROLE_BUNDLES.teacher.includes("student_achievement.archive"),
  "teacher no archive",
);
assert(
  SYSTEM_ROLE_BUNDLES.hod.includes("student_achievement.archive"),
  "hod archive",
);
assert(
  SYSTEM_ROLE_BUNDLES.student.includes("student_achievement.read"),
  "student read",
);
assert(
  SYSTEM_ROLE_BUNDLES.student.includes("payment.read"),
  "student payment preserved",
);
console.log("OK");

console.log("=== sources + categories + no event SoT duplication ===");
assert(ACHIEVEMENT_SOURCES.includes("calendar_event"), "calendar source");
assert(ACHIEVEMENT_SOURCES.includes("manual"), "manual");
assert(ACHIEVEMENT_CATEGORIES.includes("sports"), "sports");
assert(
  mustNotDuplicateEventSot().includes("event_title"),
  "no event title SoT",
);
assert(ACHIEVEMENT_VISIBILITIES.includes("school"), "vis");
assert(visibilityFlags("school").visible_to_students === true, "school vis");
console.log("OK");

console.log("=== record validations ===");
{
  const bad = validateRecordFromEventInput({ eventParticipantId: "" });
  assert(bad.eventParticipantId, "need participant");
  assert(
    Object.keys(
      validateRecordFromEventInput({
        eventParticipantId: "p1",
        points: 10,
      }),
    ).length === 0,
    "good from event",
  );
  const badM = validateManualAchievementInput({
    studentProfileId: "",
    title: "",
  });
  assert(badM.studentProfileId && badM.title, "manual req");
  assert(
    Object.keys(
      validateManualAchievementInput({
        studentProfileId: "s1",
        title: "Science Fair — 1st",
        awardLabel: "Gold",
        positionLabel: "1st",
        points: 50,
        awardedOn: "2026-08-07",
      }),
    ).length === 0,
    "good manual",
  );
}
console.log("OK");

console.log("=== filter + AI stub ===");
{
  assert(
    Object.keys(
      validateListFilter({
        academicYearId: "y1",
        source: "calendar_event",
        awardedOnFrom: "2026-04-01",
      }),
    ).length === 0,
    "filter",
  );
  assert(
    Object.keys(
      validateQueueAiSummaryInput({ studentProfileId: "s1" }),
    ).length === 0,
    "ai",
  );
}
console.log("OK");

console.log("\nAll student achievement validation smokes passed.");
