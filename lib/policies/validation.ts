import { slugCode } from "@/lib/config/codes";
import { defaultRulesForKind } from "@/lib/policies/defaults";
import {
  FUTURE_POLICY_KINDS,
  POLICY_KINDS,
  type PolicyInput,
  type PolicyKind,
  type PolicyVersionInput,
} from "@/lib/policies/types";

export function ensurePolicyCode(
  kind: PolicyKind,
  name: string,
  code?: string | null,
): string {
  if (code && code.trim()) {
    return slugCode(code.trim(), "POL");
  }
  const fromKind = slugCode(kind.replace(/_/g, "-"), "POL");
  if (name.trim()) {
    return slugCode(`${fromKind}-${name}`, "POL").slice(0, 32);
  }
  return fromKind;
}

export function isFuturePolicyKind(kind: PolicyKind): boolean {
  return FUTURE_POLICY_KINDS.includes(kind);
}

function isHhMm(value: unknown): boolean {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function validateTimeRange(
  start: unknown,
  end: unknown,
  startKey: string,
  endKey: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (start != null && !isHhMm(start)) {
    errors[startKey] = "Use HH:MM format.";
  }
  if (end != null && !isHhMm(end)) {
    errors[endKey] = "Use HH:MM format.";
  }
  if (isHhMm(start) && isHhMm(end) && String(start) >= String(end)) {
    errors[endKey] = "End time must be after start time.";
  }
  return errors;
}

export function validatePolicyInput(
  input: PolicyInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) {
    errors.name = "Policy name is required.";
  }
  if (!POLICY_KINDS.includes(input.policyKind)) {
    errors.policyKind = "Invalid policy kind.";
  }
  return errors;
}

export function validateEffectiveDates(
  from?: string | null,
  to?: string | null,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (from && to && from > to) {
    errors.effectiveTo = "Effective to must be on or after effective from.";
  }
  return errors;
}

export function validatePolicyRules(
  kind: PolicyKind,
  rules: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  switch (kind) {
    case "attendance_rules": {
      const min = rules.min_attendance_percent;
      if (typeof min === "number" && (min < 0 || min > 100)) {
        errors.min_attendance_percent = "Must be 0–100.";
      }
      break;
    }
    case "promotion_rules": {
      const overall = rules.min_overall_percent;
      const subject = rules.min_subject_pass_percent;
      if (typeof overall === "number" && (overall < 0 || overall > 100)) {
        errors.min_overall_percent = "Must be 0–100.";
      }
      if (typeof subject === "number" && (subject < 0 || subject > 100)) {
        errors.min_subject_pass_percent = "Must be 0–100.";
      }
      if (
        typeof rules.max_failed_subjects === "number" &&
        rules.max_failed_subjects < 0
      ) {
        errors.max_failed_subjects = "Cannot be negative.";
      }
      break;
    }
    case "working_hours": {
      Object.assign(
        errors,
        validateTimeRange(
          rules.staff_start,
          rules.staff_end,
          "staff_start",
          "staff_end",
        ),
        validateTimeRange(
          rules.instructional_start,
          rules.instructional_end,
          "instructional_start",
          "instructional_end",
        ),
      );
      break;
    }
    case "school_timings": {
      const days = rules.days;
      if (!Array.isArray(days) || days.length === 0) {
        errors.days = "Add at least one weekday timing.";
        break;
      }
      days.forEach((day, index) => {
        if (!day || typeof day !== "object") {
          errors[`day-${index}`] = "Invalid day entry.";
          return;
        }
        const d = day as Record<string, unknown>;
        const weekday = d.weekday;
        if (typeof weekday !== "number" || weekday < 1 || weekday > 7) {
          errors[`day-${index}-weekday`] = "Weekday must be 1–7.";
        }
        Object.assign(
          errors,
          validateTimeRange(
            d.open_time,
            d.close_time,
            `day-${index}-open_time`,
            `day-${index}-close_time`,
          ),
        );
      });
      break;
    }
    case "leave_types": {
      const types = rules.types;
      if (!Array.isArray(types) || types.length === 0) {
        errors.types = "Add at least one leave type.";
        break;
      }
      const codes = new Set<string>();
      types.forEach((row, index) => {
        if (!row || typeof row !== "object") {
          errors[`type-${index}`] = "Invalid leave type.";
          return;
        }
        const t = row as Record<string, unknown>;
        const code = String(t.code ?? "").trim();
        const name = String(t.name ?? "").trim();
        if (!code) {
          errors[`type-${index}-code`] = "Leave code is required.";
        } else if (codes.has(code.toLowerCase())) {
          errors[`type-${index}-code`] = "Duplicate leave code.";
        } else {
          codes.add(code.toLowerCase());
        }
        if (!name) {
          errors[`type-${index}-name`] = "Leave name is required.";
        }
        if (
          typeof t.max_days_per_year === "number" &&
          t.max_days_per_year < 0
        ) {
          errors[`type-${index}-max`] = "Max days cannot be negative.";
        }
      });
      break;
    }
    case "late_arrival": {
      if (typeof rules.grace_minutes === "number" && rules.grace_minutes < 0) {
        errors.grace_minutes = "Cannot be negative.";
      }
      if (rules.late_after != null && !isHhMm(rules.late_after)) {
        errors.late_after = "Use HH:MM format.";
      }
      break;
    }
    case "half_day": {
      if (rules.morning_cutoff != null && !isHhMm(rules.morning_cutoff)) {
        errors.morning_cutoff = "Use HH:MM format.";
      }
      if (rules.afternoon_start != null && !isHhMm(rules.afternoon_start)) {
        errors.afternoon_start = "Use HH:MM format.";
      }
      if (
        isHhMm(rules.morning_cutoff) &&
        isHhMm(rules.afternoon_start) &&
        String(rules.morning_cutoff) > String(rules.afternoon_start)
      ) {
        errors.afternoon_start =
          "Afternoon start cannot be before morning cutoff.";
      }
      if (
        typeof rules.min_present_minutes === "number" &&
        rules.min_present_minutes < 0
      ) {
        errors.min_present_minutes = "Cannot be negative.";
      }
      break;
    }
    case "exam_eligibility": {
      const min = rules.min_attendance_percent;
      if (typeof min === "number" && (min < 0 || min > 100)) {
        errors.min_attendance_percent = "Must be 0–100.";
      }
      break;
    }
    case "grace_marks": {
      if (
        typeof rules.max_grace_marks_per_subject === "number" &&
        rules.max_grace_marks_per_subject < 0
      ) {
        errors.max_grace_marks_per_subject = "Cannot be negative.";
      }
      if (
        typeof rules.max_grace_subjects === "number" &&
        rules.max_grace_subjects < 0
      ) {
        errors.max_grace_subjects = "Cannot be negative.";
      }
      break;
    }
    case "behaviour_rules": {
      if (
        typeof rules.warn_after_incidents === "number" &&
        rules.warn_after_incidents < 0
      ) {
        errors.warn_after_incidents = "Cannot be negative.";
      }
      if (
        typeof rules.suspend_after_incidents === "number" &&
        rules.suspend_after_incidents < 0
      ) {
        errors.suspend_after_incidents = "Cannot be negative.";
      }
      break;
    }
    case "fee_rules":
    case "transport_rules":
      // FUTURE stubs — accept any JSON object shape
      break;
    default:
      break;
  }

  return errors;
}

export function validatePolicyVersionInput(
  kind: PolicyKind,
  input: PolicyVersionInput,
): Record<string, string> {
  return {
    ...validateEffectiveDates(input.effectiveFrom, input.effectiveTo),
    ...validatePolicyRules(kind, input.rules ?? {}),
  };
}

export function mergeDefaultRules(
  kind: PolicyKind,
  rules?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...defaultRulesForKind(kind),
    ...(rules ?? {}),
  };
}
