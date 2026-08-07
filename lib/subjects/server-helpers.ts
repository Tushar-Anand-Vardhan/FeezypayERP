import type { createClient } from "@/lib/supabase/server";
import type { AssessmentRules } from "@/lib/subjects/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function assertSubjectOwned(
  supabase: Supabase,
  schoolId: string,
  subjectId: string,
  options?: { allowArchived?: boolean },
): Promise<boolean> {
  let query = supabase
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .eq("school_id", schoolId);

  if (!options?.allowArchived) {
    query = query.is("archived_at", null);
  }

  const { data } = await query.maybeSingle();
  return Boolean(data);
}

export async function assertSubjectGroupOwned(
  supabase: Supabase,
  schoolId: string,
  groupId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("subject_groups")
    .select("id")
    .eq("id", groupId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export function assessmentRulesToJson(rules: AssessmentRules): Record<string, unknown> {
  return {
    grading_type: rules.gradingType ?? null,
    max_marks: rules.maxMarks ?? null,
    pass_marks: rules.passMarks ?? null,
    has_practical: rules.hasPractical ?? false,
    practical_weightage: rules.practicalWeightage ?? null,
    internal_assessment: rules.internalAssessment ?? false,
    internal_max_marks: rules.internalMaxMarks ?? null,
  };
}

export function assessmentRulesFromJson(raw: unknown): AssessmentRules {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const o = raw as Record<string, unknown>;
  return {
    gradingType:
      o.grading_type === "marks" ||
      o.grading_type === "grade" ||
      o.grading_type === "pass_fail"
        ? o.grading_type
        : undefined,
    maxMarks: typeof o.max_marks === "number" ? o.max_marks : null,
    passMarks: typeof o.pass_marks === "number" ? o.pass_marks : null,
    hasPractical: Boolean(o.has_practical),
    practicalWeightage:
      typeof o.practical_weightage === "number" ? o.practical_weightage : null,
    internalAssessment: Boolean(o.internal_assessment),
    internalMaxMarks:
      typeof o.internal_max_marks === "number" ? o.internal_max_marks : null,
  };
}

export function subjectMasterPayload(
  trimmed: ReturnType<
    typeof import("@/lib/subjects/validation").trimSubjectMasterInput
  >,
  actorId: string | null,
) {
  return {
    name: trimmed.name,
    description: trimmed.description || null,
    type: trimmed.type ?? "scholastic",
    category: trimmed.category ?? "scholastic",
    subject_group_id: trimmed.subjectGroupId,
    is_language: trimmed.isLanguage ?? false,
    language_code: trimmed.languageCode,
    is_elective: trimmed.isElective ?? false,
    board_code: trimmed.boardCode,
    board_subject_name: trimmed.boardSubjectName,
    credits: trimmed.credits,
    weekly_periods: trimmed.weeklyPeriods,
    requires_lab: trimmed.requiresLab ?? false,
    display_order: trimmed.displayOrder ?? 0,
    assessment_rules: assessmentRulesToJson(trimmed.assessmentRules ?? {}),
    textbook_isbn: trimmed.textbookIsbn,
    textbook_title: trimmed.textbookTitle,
    ai_lesson_plan_enabled: trimmed.aiLessonPlanEnabled ?? false,
    chapter_map: trimmed.chapterMap ?? [],
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };
}
