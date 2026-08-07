import { slugCode } from "@/lib/config/codes";
import {
  COMM_CHANNELS,
  type ApprovalRuleInput,
  type AudienceFilterRules,
  type AudienceGroupInput,
  type AutomationInput,
  type CampaignInput,
  type CategoryInput,
  type CommChannel,
  type DeliveryRuleInput,
  type PriorityInput,
  type TemplateInput,
  type TemplateVersionInput,
} from "@/lib/communications/types";

export function ensureCommCode(
  name: string,
  code?: string | null,
  prefix = "COMM",
): string {
  if (code && code.trim()) {
    return slugCode(code.trim(), prefix);
  }
  return slugCode(name, prefix);
}

export function filterRulesToJson(
  rules?: AudienceFilterRules,
): Record<string, unknown> {
  return {
    roles: rules?.roles ?? [],
    class_ids: rules?.classIds ?? [],
    section_ids: rules?.sectionIds ?? [],
    include_parents: rules?.includeParents ?? false,
    include_students: rules?.includeStudents ?? false,
    include_staff: rules?.includeStaff ?? false,
  };
}

export function filterRulesFromJson(raw: unknown): AudienceFilterRules {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const o = raw as Record<string, unknown>;
  return {
    roles: Array.isArray(o.roles) ? o.roles.map(String) : [],
    classIds: Array.isArray(o.class_ids) ? o.class_ids.map(String) : [],
    sectionIds: Array.isArray(o.section_ids) ? o.section_ids.map(String) : [],
    includeParents: Boolean(o.include_parents),
    includeStudents: Boolean(o.include_students),
    includeStaff: Boolean(o.include_staff),
  };
}

export function validateCategoryInput(
  input: CategoryInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) {
    errors.name = "Category name is required.";
  }
  if (input.colour && !/^#[0-9A-Fa-f]{6}$/.test(input.colour.trim())) {
    errors.colour = "Colour must be a #RRGGBB hex value.";
  }
  return errors;
}

export function validatePriorityInput(
  input: PriorityInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) {
    errors.name = "Priority name is required.";
  }
  if (input.rank != null && input.rank < 0) {
    errors.rank = "Rank cannot be negative.";
  }
  return errors;
}

export function validateAudienceGroupInput(
  input: AudienceGroupInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) {
    errors.name = "Audience group name is required.";
  }
  const f = input.filterRules;
  if (
    f &&
    !(
      (f.roles && f.roles.length > 0) ||
      (f.classIds && f.classIds.length > 0) ||
      (f.sectionIds && f.sectionIds.length > 0) ||
      f.includeParents ||
      f.includeStudents ||
      f.includeStaff
    )
  ) {
    errors.filterRules = "Define at least one audience filter.";
  }
  return errors;
}

export function validateTemplateInput(
  input: TemplateInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) {
    errors.name = "Template name is required.";
  }
  if (!COMM_CHANNELS.includes(input.channel)) {
    errors.channel = "Invalid channel.";
  }
  if (input.locale && input.locale.trim().length < 2) {
    errors.locale = "Locale looks invalid.";
  }
  return errors;
}

export function validateTemplateVersionInput(
  input: TemplateVersionInput,
  channel?: CommChannel,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.templateId?.trim()) {
    errors.templateId = "Template is required.";
  }
  if (!input.body?.trim()) {
    errors.body = "Template body is required.";
  }
  if (channel === "email" && !input.subject?.trim()) {
    errors.subject = "Email subject is required.";
  }
  if (input.placeholders) {
    input.placeholders.forEach((p, i) => {
      if (!p.trim()) {
        errors[`placeholder-${i}`] = "Placeholder cannot be empty.";
      }
    });
  }
  return errors;
}

export function validateDeliveryRuleInput(
  input: DeliveryRuleInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) {
    errors.name = "Delivery rule name is required.";
  }
  if (input.channels) {
    for (const ch of input.channels) {
      if (!COMM_CHANNELS.includes(ch)) {
        errors.channels = `Invalid channel: ${ch}`;
        break;
      }
    }
  }
  return errors;
}

export function validateApprovalRuleInput(
  input: ApprovalRuleInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) {
    errors.name = "Approval rule name is required.";
  }
  if (
    input.requireApproval !== false &&
    input.approverRoles &&
    input.approverRoles.length === 0
  ) {
    errors.approverRoles = "Add at least one approver role.";
  }
  return errors;
}

export function validateAutomationInput(
  input: AutomationInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) {
    errors.name = "Automation name is required.";
  }
  return errors;
}

export function validateCampaignInput(
  input: CampaignInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) {
    errors.name = "Campaign name is required.";
  }
  return errors;
}

export function extractPlaceholders(body: string, subject?: string): string[] {
  const text = `${subject ?? ""}\n${body}`;
  const matches = text.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}
