/** Report Card Template Engine (E20 Document config surface) — no PDF issue. */

export type ReportCardActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type TemplateStatus = "draft" | "published" | "retired";

export type BlockType =
  | "header"
  | "student_info"
  | "grades"
  | "remarks"
  | "attendance"
  | "co_curricular"
  | "teacher_comments"
  | "principal_comments"
  | "signatures"
  | "custom"
  | "spacer";

export type SignatureType = "wet_ink" | "image_placeholder" | "digital_stub";

export type LayoutConfig = {
  pageSize?: "A4" | "Letter";
  orientation?: "portrait" | "landscape";
  marginsMm?: { top?: number; right?: number; bottom?: number; left?: number };
  theme?: string;
  customCssVars?: Record<string, string>;
};

export type BoardInput = {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  displayOrder?: number;
};

export type TemplateInput = {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  boardId?: string | null;
  academicYearId?: string | null;
  termId?: string | null;
  status?: TemplateStatus;
  layoutConfig?: LayoutConfig;
  includeGrades?: boolean;
  includeRemarks?: boolean;
  includeAttendance?: boolean;
  includeCoCurricular?: boolean;
  includeTeacherComments?: boolean;
  includePrincipalComments?: boolean;
  includeSignatures?: boolean;
  pdfGenerationEnabled?: boolean;
  digitalSignatureEnabled?: boolean;
};

export type ScopeInput = {
  id?: string;
  templateId: string;
  classId?: string | null;
  sectionId?: string | null;
  displayOrder?: number;
};

export type AssessmentBindingInput = {
  id?: string;
  templateId: string;
  examDefinitionId: string;
  displayLabel?: string;
  displayOrder?: number;
  includeComponents?: boolean;
  showMaxMarks?: boolean;
  showPassMarks?: boolean;
  showGrades?: boolean;
};

export type BlockInput = {
  id?: string;
  templateId: string;
  blockType: BlockType;
  title?: string;
  config?: Record<string, unknown>;
  displayOrder?: number;
  isVisible?: boolean;
};

export type SignatureSlotInput = {
  id?: string;
  templateId: string;
  roleLabel: string;
  signatureType?: SignatureType;
  displayOrder?: number;
  requiresDigital?: boolean;
};

export const TEMPLATE_STATUSES: TemplateStatus[] = [
  "draft",
  "published",
  "retired",
];

export const BLOCK_TYPES: BlockType[] = [
  "header",
  "student_info",
  "grades",
  "remarks",
  "attendance",
  "co_curricular",
  "teacher_comments",
  "principal_comments",
  "signatures",
  "custom",
  "spacer",
];

export const SIGNATURE_TYPES: SignatureType[] = [
  "wet_ink",
  "image_placeholder",
  "digital_stub",
];

export const DEFAULT_BLOCK_BLUEPRINT: Array<{
  blockType: BlockType;
  title: string;
  displayOrder: number;
}> = [
  { blockType: "header", title: "Header", displayOrder: 1 },
  { blockType: "student_info", title: "Student information", displayOrder: 2 },
  { blockType: "grades", title: "Grades", displayOrder: 3 },
  { blockType: "attendance", title: "Attendance", displayOrder: 4 },
  { blockType: "co_curricular", title: "Co-curricular", displayOrder: 5 },
  { blockType: "remarks", title: "Remarks", displayOrder: 6 },
  { blockType: "teacher_comments", title: "Teacher comments", displayOrder: 7 },
  {
    blockType: "principal_comments",
    title: "Principal comments",
    displayOrder: 8,
  },
  { blockType: "signatures", title: "Signatures", displayOrder: 9 },
];
