"use server";

import { revalidatePath } from "next/cache";
import { ensureSubjectCode } from "@/lib/config/codes";
import {
  archiveSubjectAction as archiveConfigSubjectAction,
  restoreSubjectAction as restoreConfigSubjectAction,
} from "@/lib/config/subjects-actions";
import {
  assertSubjectGroupOwned,
  assertSubjectOwned,
  assessmentRulesFromJson,
  getActorId,
  subjectMasterPayload,
} from "@/lib/subjects/server-helpers";
import type { SubjectActionResult, SubjectMasterInput } from "@/lib/subjects/types";
import {
  trimSubjectMasterInput,
  validateSubjectMasterInput,
} from "@/lib/subjects/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/subjects");
  revalidatePath("/onboarding", "layout");
}

export async function listSubjectMasterAction(options?: {
  includeArchived?: boolean;
  subjectGroupId?: string;
}): Promise<
  | {
      success: true;
      subjects: Array<{
        id: string;
        name: string;
        code: string | null;
        description: string | null;
        type: string;
        category: string;
        subject_group_id: string | null;
        is_language: boolean;
        language_code: string | null;
        is_elective: boolean;
        board_code: string | null;
        board_subject_name: string | null;
        credits: number | null;
        weekly_periods: number | null;
        requires_lab: boolean;
        display_order: number;
        assessment_rules: unknown;
        textbook_isbn: string | null;
        textbook_title: string | null;
        ai_lesson_plan_enabled: boolean;
        chapter_map: unknown;
        archived_at: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("subjects")
    .select(
      "id, name, code, description, type, category, subject_group_id, is_language, language_code, is_elective, board_code, board_subject_name, credits, weekly_periods, requires_lab, display_order, assessment_rules, textbook_isbn, textbook_title, ai_lesson_plan_enabled, chapter_map, archived_at",
    )
    .eq("school_id", schoolId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (options?.subjectGroupId) {
    query = query.eq("subject_group_id", options.subjectGroupId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, subjects: data ?? [] };
}

export async function getSubjectMasterAction(subjectId: string): Promise<
  | {
      success: true;
      subject: SubjectMasterInput & { id: string; archivedAt: string | null };
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data, error } = await supabase
    .from("subjects")
    .select(
      "id, name, code, description, type, category, subject_group_id, is_language, language_code, is_elective, board_code, board_subject_name, credits, weekly_periods, requires_lab, display_order, assessment_rules, textbook_isbn, textbook_title, ai_lesson_plan_enabled, chapter_map, archived_at",
    )
    .eq("id", subjectId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Subject not found." };
  }

  return {
    success: true,
    subject: {
      id: data.id,
      name: data.name,
      code: data.code ?? "",
      description: data.description ?? "",
      type: data.type as "scholastic" | "co_scholastic",
      category: data.category as SubjectMasterInput["category"],
      subjectGroupId: data.subject_group_id,
      isLanguage: data.is_language,
      languageCode: data.language_code,
      isElective: data.is_elective,
      boardCode: data.board_code,
      boardSubjectName: data.board_subject_name,
      credits: data.credits != null ? Number(data.credits) : null,
      weeklyPeriods: data.weekly_periods,
      requiresLab: data.requires_lab,
      displayOrder: data.display_order,
      assessmentRules: assessmentRulesFromJson(data.assessment_rules),
      textbookIsbn: data.textbook_isbn,
      textbookTitle: data.textbook_title,
      aiLessonPlanEnabled: data.ai_lesson_plan_enabled,
      chapterMap: Array.isArray(data.chapter_map) ? data.chapter_map : [],
      archivedAt: data.archived_at,
    },
  };
}

export async function createSubjectMasterAction(
  input: SubjectMasterInput,
): Promise<SubjectActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimSubjectMasterInput(input);
  const fieldErrors = validateSubjectMasterInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  if (
    trimmed.subjectGroupId &&
    !(await assertSubjectGroupOwned(supabase, schoolId, trimmed.subjectGroupId))
  ) {
    return { success: false, error: "Subject group not found." };
  }

  const code = ensureSubjectCode(trimmed.name, trimmed.code);
  const payload = subjectMasterPayload(trimmed, actorId);

  const { data, error } = await supabase
    .from("subjects")
    .insert({
      school_id: schoolId,
      ...payload,
      code,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create subject.",
    };
  }

  revalidate();
  return { success: true, message: "Subject created.", id: data.id };
}

export async function updateSubjectMasterAction(
  input: SubjectMasterInput & { id: string },
): Promise<SubjectActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimSubjectMasterInput(input);
  const fieldErrors = validateSubjectMasterInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (!(await assertSubjectOwned(supabase, schoolId, input.id))) {
    return { success: false, error: "Subject not found." };
  }

  if (
    trimmed.subjectGroupId &&
    !(await assertSubjectGroupOwned(supabase, schoolId, trimmed.subjectGroupId))
  ) {
    return { success: false, error: "Subject group not found." };
  }

  const actorId = await getActorId(supabase);
  const code = ensureSubjectCode(trimmed.name, trimmed.code);
  const payload = subjectMasterPayload(trimmed, actorId);

  const { error } = await supabase
    .from("subjects")
    .update({ ...payload, code })
    .eq("id", input.id)
    .eq("school_id", schoolId)
    .is("archived_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Subject updated.", id: input.id };
}

export async function archiveSubjectMasterAction(
  subjectId: string,
): Promise<SubjectActionResult> {
  const result = await archiveConfigSubjectAction(subjectId);
  revalidate();
  return result;
}

export async function restoreSubjectMasterAction(
  subjectId: string,
): Promise<SubjectActionResult> {
  const result = await restoreConfigSubjectAction(subjectId);
  revalidate();
  return result;
}
