import type { PolicyKind } from "@/lib/policies/types";

/** Default rule payloads for seeded / new policies. */
export function defaultRulesForKind(
  kind: PolicyKind,
): Record<string, unknown> {
  switch (kind) {
    case "attendance_rules":
      return {
        min_attendance_percent: 75,
        consecutive_absence_alert_days: 3,
        count_late_as_absent_after: 3,
        include_half_day_as: "half",
      };
    case "promotion_rules":
      return {
        min_overall_percent: 33,
        min_subject_pass_percent: 33,
        allow_compartment: true,
        max_failed_subjects: 2,
        require_attendance_policy: true,
      };
    case "working_hours":
      return {
        staff_start: "08:00",
        staff_end: "15:00",
        instructional_start: "08:30",
        instructional_end: "14:30",
        timezone: "Asia/Kolkata",
      };
    case "school_timings":
      return {
        timezone: "Asia/Kolkata",
        days: [
          { weekday: 1, open_time: "08:00", close_time: "14:30" },
          { weekday: 2, open_time: "08:00", close_time: "14:30" },
          { weekday: 3, open_time: "08:00", close_time: "14:30" },
          { weekday: 4, open_time: "08:00", close_time: "14:30" },
          { weekday: 5, open_time: "08:00", close_time: "14:30" },
          { weekday: 6, open_time: "08:00", close_time: "12:30" },
        ],
      };
    case "leave_types":
      return {
        types: [
          {
            code: "CL",
            name: "Casual leave",
            paid: true,
            max_days_per_year: 12,
            requires_approval: true,
          },
          {
            code: "SL",
            name: "Sick leave",
            paid: true,
            max_days_per_year: 10,
            requires_approval: true,
          },
          {
            code: "ML",
            name: "Medical leave",
            paid: true,
            max_days_per_year: null,
            requires_approval: true,
          },
        ],
      };
    case "late_arrival":
      return {
        grace_minutes: 10,
        late_after: "08:40",
        mark_absent_after_minutes: 60,
        max_lates_per_month: 3,
      };
    case "half_day":
      return {
        morning_cutoff: "11:00",
        afternoon_start: "11:00",
        min_present_minutes: 180,
      };
    case "exam_eligibility":
      return {
        min_attendance_percent: 75,
        require_fee_clearance: false,
        allow_medical_exception: true,
      };
    case "grace_marks":
      return {
        max_grace_marks_per_subject: 5,
        max_grace_subjects: 2,
        apply_only_to_pass_borderline: true,
        enabled: false,
      };
    case "behaviour_rules":
      return {
        warn_after_incidents: 2,
        suspend_after_incidents: 5,
        track_positive_remarks: true,
        categories: ["discipline", "uniform", "bullying", "other"],
      };
    case "fee_rules":
      return {
        future: true,
        note: "Fee policy runtime not wired (E15).",
        late_fee_enabled: false,
      };
    case "transport_rules":
      return {
        future: true,
        note: "Transport policy runtime not wired.",
        enabled: false,
      };
    default:
      return {};
  }
}
