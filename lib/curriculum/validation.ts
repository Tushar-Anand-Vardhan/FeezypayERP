import type {
  CloneCurriculumInput,
  CompetencyInput,
  CurriculumPackInput,
  LearningOutcomeInput,
  NoteInput,
  ProgressInput,
  ProgressStatus,
  ResourceInput,
  StructureNodeInput,
  StructureNodeKind,
} from "@/lib/curriculum/types";
import {
  PROGRESS_STATUSES,
  STRUCTURE_EDIT_PERMISSIONS,
} from "@/lib/curriculum/types";

export function validatePackInput(
  input: CurriculumPackInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.academicYearId?.trim()) errors.academicYearId = "Required";
  if (!input.subjectId?.trim()) errors.subjectId = "Required";
  if (!input.classId?.trim()) errors.classId = "Required";
  if (!input.name?.trim()) errors.name = "Required";
  if (
    input.suggestedTotalHours != null &&
    (Number.isNaN(input.suggestedTotalHours) || input.suggestedTotalHours < 0)
  ) {
    errors.suggestedTotalHours = "Must be ≥ 0";
  }
  return errors;
}

export function validateStructureNodeInput(
  kind: StructureNodeKind,
  input: StructureNodeInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.curriculumId?.trim()) errors.curriculumId = "Required";
  if (!input.title?.trim()) errors.title = "Required";
  if (
    input.suggestedHours != null &&
    (Number.isNaN(input.suggestedHours) || input.suggestedHours < 0)
  ) {
    errors.suggestedHours = "Must be ≥ 0";
  }
  if (input.displayOrder != null && input.displayOrder < 0) {
    errors.displayOrder = "Must be ≥ 0";
  }
  if (kind === "chapter" && !input.unitId?.trim()) {
    errors.unitId = "Chapter requires unit";
  }
  if (kind === "topic" && !input.chapterId?.trim()) {
    errors.chapterId = "Topic requires chapter";
  }
  if (kind === "subtopic" && !input.topicId?.trim()) {
    errors.topicId = "Subtopic requires topic";
  }
  return errors;
}

/** Detect duplicate display_order among siblings (active only). */
export function validateOrderUniqueness(orders: number[]): string | null {
  const seen = new Set<number>();
  for (const o of orders) {
    if (seen.has(o)) return `Duplicate display_order ${o}`;
    seen.add(o);
  }
  return null;
}

/** Hierarchy integrity: child parent must exist in provided id sets. */
export function validateHierarchyIntegrity(input: {
  unitIds: Set<string>;
  chapterUnitIds: Map<string, string>;
  topicChapterIds: Map<string, string>;
  subtopicTopicIds: Map<string, string>;
}): string | null {
  for (const [, unitId] of input.chapterUnitIds) {
    if (!input.unitIds.has(unitId)) return "Orphan chapter: unknown unit";
  }
  for (const [, chapterId] of input.topicChapterIds) {
    if (!input.chapterUnitIds.has(chapterId)) {
      return "Orphan topic: unknown chapter";
    }
  }
  for (const [, topicId] of input.subtopicTopicIds) {
    if (!input.topicChapterIds.has(topicId)) {
      return "Orphan subtopic: unknown topic";
    }
  }
  return null;
}

export function validateLearningOutcomeInput(
  input: LearningOutcomeInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.curriculumId?.trim()) errors.curriculumId = "Required";
  if (!input.statement?.trim()) errors.statement = "Required";
  return errors;
}

export function validateCompetencyInput(
  input: CompetencyInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.curriculumId?.trim()) errors.curriculumId = "Required";
  if (!input.name?.trim()) errors.name = "Required";
  return errors;
}

export function validateResourceInput(
  input: ResourceInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.curriculumId?.trim()) errors.curriculumId = "Required";
  if (!input.title?.trim()) errors.title = "Required";
  return errors;
}

export function validateNoteInput(input: NoteInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.curriculumId?.trim()) errors.curriculumId = "Required";
  if (!input.body?.trim()) errors.body = "Required";
  if (!input.authorEmploymentId?.trim()) {
    errors.authorEmploymentId = "Required";
  }
  return errors;
}

export function validateProgressInput(
  input: ProgressInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.curriculumId?.trim()) errors.curriculumId = "Required";
  if (!input.curriculumVersionId?.trim()) {
    errors.curriculumVersionId = "Required";
  }
  if (!input.sectionId?.trim()) errors.sectionId = "Required";
  if (!input.employmentId?.trim()) errors.employmentId = "Required";
  if (!input.nodeId?.trim()) errors.nodeId = "Required";
  if (!PROGRESS_STATUSES.includes(input.status as ProgressStatus)) {
    errors.status = "Invalid status";
  }
  if (
    input.completionPct != null &&
    (input.completionPct < 0 || input.completionPct > 100)
  ) {
    errors.completionPct = "Must be 0–100";
  }
  return errors;
}

export function validateCloneInput(
  input: CloneCurriculumInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.sourceCurriculumId?.trim()) {
    errors.sourceCurriculumId = "Required";
  }
  if (!input.targetAcademicYearId?.trim()) {
    errors.targetAcademicYearId = "Required";
  }
  return errors;
}

/** Smoke: structure.edit is in the HOD permission list, not teacher-only. */
export function structureEditPermissionKeys(): readonly string[] {
  return STRUCTURE_EDIT_PERMISSIONS;
}

export function isStructureEditPermission(key: string): boolean {
  return (STRUCTURE_EDIT_PERMISSIONS as readonly string[]).includes(key);
}
