import { slugCode } from "@/lib/config/codes";
import {
  BLOCK_TYPES,
  SIGNATURE_TYPES,
  TEMPLATE_STATUSES,
  type AssessmentBindingInput,
  type BlockInput,
  type BoardInput,
  type LayoutConfig,
  type ScopeInput,
  type SignatureSlotInput,
  type TemplateInput,
} from "@/lib/report-cards/types";

export function ensureBoardCode(name: string, code?: string | null): string {
  if (code && code.trim()) {
    return slugCode(code.trim(), "BRD");
  }
  return slugCode(name, "BRD");
}

export function ensureTemplateCode(name: string, code?: string | null): string {
  if (code && code.trim()) {
    return slugCode(code.trim(), "RCT");
  }
  return slugCode(name, "RCT");
}

export function normalizeLayoutConfig(config?: LayoutConfig): LayoutConfig {
  return {
    pageSize: config?.pageSize ?? "A4",
    orientation: config?.orientation ?? "portrait",
    marginsMm: {
      top: config?.marginsMm?.top ?? 12,
      right: config?.marginsMm?.right ?? 12,
      bottom: config?.marginsMm?.bottom ?? 12,
      left: config?.marginsMm?.left ?? 12,
    },
    theme: config?.theme ?? "default",
    customCssVars: config?.customCssVars ?? {},
  };
}

export function layoutConfigToJson(config?: LayoutConfig): Record<string, unknown> {
  const c = normalizeLayoutConfig(config);
  return {
    page_size: c.pageSize,
    orientation: c.orientation,
    margins_mm: c.marginsMm,
    theme: c.theme,
    custom_css_vars: c.customCssVars,
  };
}

export function layoutConfigFromJson(raw: unknown): LayoutConfig {
  if (!raw || typeof raw !== "object") {
    return normalizeLayoutConfig();
  }
  const o = raw as Record<string, unknown>;
  const margins =
    o.margins_mm && typeof o.margins_mm === "object"
      ? (o.margins_mm as Record<string, unknown>)
      : {};
  return normalizeLayoutConfig({
    pageSize: o.page_size === "Letter" ? "Letter" : "A4",
    orientation: o.orientation === "landscape" ? "landscape" : "portrait",
    marginsMm: {
      top: typeof margins.top === "number" ? margins.top : undefined,
      right: typeof margins.right === "number" ? margins.right : undefined,
      bottom: typeof margins.bottom === "number" ? margins.bottom : undefined,
      left: typeof margins.left === "number" ? margins.left : undefined,
    },
    theme: typeof o.theme === "string" ? o.theme : undefined,
    customCssVars:
      o.custom_css_vars && typeof o.custom_css_vars === "object"
        ? (o.custom_css_vars as Record<string, string>)
        : undefined,
  });
}

export function validateBoardInput(input: BoardInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) {
    errors.name = "Board name is required.";
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
  if (input.status && !TEMPLATE_STATUSES.includes(input.status)) {
    errors.status = "Invalid template status.";
  }
  const layout = input.layoutConfig;
  if (layout?.pageSize && layout.pageSize !== "A4" && layout.pageSize !== "Letter") {
    errors.pageSize = "Page size must be A4 or Letter.";
  }
  if (
    layout?.orientation &&
    layout.orientation !== "portrait" &&
    layout.orientation !== "landscape"
  ) {
    errors.orientation = "Orientation must be portrait or landscape.";
  }
  return errors;
}

export function validateScopeInput(input: ScopeInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.templateId?.trim()) {
    errors.templateId = "Template is required.";
  }
  if (!input.classId?.trim() && !input.sectionId?.trim()) {
    errors.scope = "Select a class and/or section.";
  }
  return errors;
}

export function validateAssessmentBindingInput(
  input: AssessmentBindingInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.templateId?.trim()) {
    errors.templateId = "Template is required.";
  }
  if (!input.examDefinitionId?.trim()) {
    errors.examDefinitionId = "Assessment is required.";
  }
  return errors;
}

export function validateBlockInput(input: BlockInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.templateId?.trim()) {
    errors.templateId = "Template is required.";
  }
  if (!BLOCK_TYPES.includes(input.blockType)) {
    errors.blockType = "Invalid block type.";
  }
  return errors;
}

export function validateSignatureSlotInput(
  input: SignatureSlotInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.templateId?.trim()) {
    errors.templateId = "Template is required.";
  }
  if (!input.roleLabel?.trim()) {
    errors.roleLabel = "Signature role label is required.";
  }
  if (input.signatureType && !SIGNATURE_TYPES.includes(input.signatureType)) {
    errors.signatureType = "Invalid signature type.";
  }
  return errors;
}

/** Published / retired templates should not accept structural edits. */
export function isTemplateMutable(status: string | undefined): boolean {
  return status === "draft" || status === undefined;
}
