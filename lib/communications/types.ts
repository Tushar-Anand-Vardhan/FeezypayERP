/** Communication Configuration Engine (E18) — content config only; no sending. */

export type CommActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type CommChannel =
  | "notification"
  | "email"
  | "whatsapp"
  | "sms"
  | "in_app";

export type TemplateStatus = "draft" | "published" | "retired";

export type AudienceFilterRules = {
  roles?: string[];
  classIds?: string[];
  sectionIds?: string[];
  includeParents?: boolean;
  includeStudents?: boolean;
  includeStaff?: boolean;
};

export type CategoryInput = {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  colour?: string;
  displayOrder?: number;
};

export type PriorityInput = {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  rank?: number;
  bypassQuietHours?: boolean;
  displayOrder?: number;
};

export type AudienceGroupInput = {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  filterRules?: AudienceFilterRules;
  displayOrder?: number;
};

export type TemplateInput = {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  channel: CommChannel;
  categoryId?: string | null;
  locale?: string;
  providerTemplateName?: string;
  providerTemplateLocale?: string;
};

export type TemplateVersionInput = {
  templateId: string;
  subject?: string;
  body: string;
  placeholders?: string[];
  metadata?: Record<string, unknown>;
  changeSummary?: string;
};

export type DeliveryRuleInput = {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  eventCode?: string;
  channels?: CommChannel[];
  priorityId?: string | null;
  audienceGroupId?: string | null;
  templateId?: string | null;
  categoryId?: string | null;
  respectQuietHours?: boolean;
  requireConsent?: boolean;
  isEnabled?: boolean;
  rules?: Record<string, unknown>;
};

export type ApprovalRuleInput = {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  requireApproval?: boolean;
  minPriorityId?: string | null;
  categoryId?: string | null;
  audienceGroupId?: string | null;
  approverRoles?: string[];
  isEnabled?: boolean;
  rules?: Record<string, unknown>;
};

export type AutomationInput = {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  triggerEvent?: string;
  deliveryRuleId?: string | null;
  isEnabled?: boolean;
  config?: Record<string, unknown>;
};

export type CampaignInput = {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  audienceGroupId?: string | null;
  templateId?: string | null;
  scheduledAt?: string | null;
  config?: Record<string, unknown>;
};

export const COMM_CHANNELS: CommChannel[] = [
  "notification",
  "email",
  "whatsapp",
  "sms",
  "in_app",
];

export const TEMPLATE_STATUSES: TemplateStatus[] = [
  "draft",
  "published",
  "retired",
];
