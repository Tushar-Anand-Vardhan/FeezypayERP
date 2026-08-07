/** Report Card Template Engine (E20 Document config surface) — no PDF issue. */

export type ReportCardActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type TemplateStatus = "draft" | "published" | "retired";

export type BlockType =
  | "header"
  | "student_info"
  | "grades"
  | "grade_summary"
  | "remarks"
  | "attendance"
  | "co_curricular"
  | "achievements"
  | "behaviour"
  | "curriculum"
  | "observations"
  | "promotion"
  | "teacher_comments"
  | "principal_comments"
  | "signatures"
  | "custom"
  | "spacer";

export type FieldAssigneeRole =
  | "teacher"
  | "class_teacher"
  | "subject_teacher"
  | "hod"
  | "principal"
  | "vice_principal"
  | "admin";

export type FieldAssignmentInput = {
  id?: string;
  templateId: string;
  fieldKey: string;
  fieldLabel: string;
  assigneeRole?: FieldAssigneeRole;
  subjectId?: string | null;
  required?: boolean;
  maxLength?: number;
  displayOrder?: number;
};

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
  includeAchievements?: boolean;
  includeBehaviour?: boolean;
  includeCurriculum?: boolean;
  includeObservations?: boolean;
  includePromotion?: boolean;
  preferGradeCalculation?: boolean;
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
  "grade_summary",
  "remarks",
  "attendance",
  "co_curricular",
  "achievements",
  "behaviour",
  "curriculum",
  "observations",
  "promotion",
  "teacher_comments",
  "principal_comments",
  "signatures",
  "custom",
  "spacer",
];

export const FIELD_ASSIGNEE_ROLES: FieldAssigneeRole[] = [
  "teacher",
  "class_teacher",
  "subject_teacher",
  "hod",
  "principal",
  "vice_principal",
  "admin",
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
  { blockType: "grades", title: "Assessment results", displayOrder: 3 },
  { blockType: "grade_summary", title: "Grade summary", displayOrder: 4 },
  { blockType: "attendance", title: "Attendance", displayOrder: 5 },
  { blockType: "behaviour", title: "Behaviour", displayOrder: 6 },
  { blockType: "co_curricular", title: "Co-curricular", displayOrder: 7 },
  { blockType: "achievements", title: "Achievements", displayOrder: 8 },
  { blockType: "curriculum", title: "Curriculum completion", displayOrder: 9 },
  { blockType: "observations", title: "Observations", displayOrder: 10 },
  { blockType: "promotion", title: "Promotion status", displayOrder: 11 },
  { blockType: "remarks", title: "Remarks", displayOrder: 12 },
  { blockType: "teacher_comments", title: "Teacher comments", displayOrder: 13 },
  {
    blockType: "principal_comments",
    title: "Principal comments",
    displayOrder: 14,
  },
  { blockType: "signatures", title: "Signatures", displayOrder: 15 },
];
