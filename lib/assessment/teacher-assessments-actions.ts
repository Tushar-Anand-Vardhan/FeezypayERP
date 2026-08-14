"use server";

import { revalidatePath } from "next/cache";
import {
  assertClassInSchool,
  assertExamDefinitionOwned,
  assertSubjectOwned,
  assertTermInYear,
  assertYearOwned,
  getActorId,
} from "@/lib/assessment/server-helpers";
import {
  assertEmploymentOwned,
  assertSectionInSchool,
  writeAssessmentAudit,
} from "@/lib/assessment/ops-server-helpers";
import type {
  AssessmentOpsActionResult,
  TeacherAssessmentInput,
} from "@/lib/assessment/ops-types";
import { validateTeacherAssessmentInput } from "@/lib/assessment/ops-validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/assessments");
}

const KIND_TO_LEGACY_CATEGORY: Record<string, string> = {
  class_test: "unit_test",
  project: "project",
  practical: "practical",
  assignment: "internal",
  oral: "oral",
  other: "other",
};

export async function createTeacherAssessmentAction(
  input: TeacherAssessmentInput,
): Promise<AssessmentOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.results.enter");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateTeacherAssessmentInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }
  if (
    input.termId &&
    !(await assertTermInYear(supabase, input.academicYearId, input.termId))
  ) {
    return { success: false, error: "Term not found in year." };
  }
  if (!(await assertSubjectOwned(supabase, schoolId, input.subjectId))) {
    return { success: false, error: "Subject not found." };
  }
  if (!(await assertClassInSchool(supabase, schoolId, input.classId))) {
    return { success: false, error: "Class not found." };
  }
  if (input.sectionId) {
    const section = await assertSectionInSchool(
      supabase,
      schoolId,
      input.sectionId,
    );
    if (!section || section.classId !== input.classId) {
      return { success: false, error: "Section not found in class." };
    }
  }
  if (
    input.employmentId &&
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const legacyCategory =
    KIND_TO_LEGACY_CATEGORY[input.operationalKind] ?? "other";

  const { data: exam, error: examError } = await supabase
    .from("exam_definitions")
    .insert({
      academic_year_id: input.academicYearId,
      class_id: input.classId,
      term_id: input.termId ?? null,
      name: input.name.trim(),
      category: legacyCategory,
      weightage_percent: input.weightagePercent ?? null,
      max_marks: input.maxMarks,
      pass_marks: input.passMarks ?? null,
      grading_type: input.gradingType ?? "marks",
      exam_type_id: input.examTypeId ?? null,
      assessment_category_id: input.assessmentCategoryId ?? null,
      origin: "teacher",
      operational_kind: input.operationalKind,
      created_by_employment_id: input.employmentId ?? null,
      assessed_on: input.assessedOn ?? null,
      due_on: input.dueOn ?? null,
      description: input.description ?? null,
      publishing_status: "draft",
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (examError || !exam) {
    return {
      success: false,
      error: examError?.message ?? "Failed to create assessment.",
    };
  }

  const { error: scheduleError } = await supabase
    .from("exam_subject_schedules")
    .insert({
      exam_definition_id: exam.id,
      subject_id: input.subjectId,
      class_id: input.classId,
      section_id: input.sectionId ?? null,
      grading_type: input.gradingType ?? "marks",
      max_marks: input.maxMarks,
      pass_marks: input.passMarks ?? null,
      scheduled_at: input.assessedOn
        ? `${input.assessedOn}T00:00:00.000Z`
        : null,
    });

  if (scheduleError) {
    await supabase
      .from("exam_definitions")
      .update({
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", exam.id);
    return { success: false, error: scheduleError.message };
  }

  await writeAssessmentAudit(supabase, {
    schoolId,
    action: "assessment.teacher_created",
    actorId,
    examDefinitionId: exam.id,
    newValues: {
      name: input.name,
      operational_kind: input.operationalKind,
      subject_id: input.subjectId,
      class_id: input.classId,
      section_id: input.sectionId ?? null,
    },
  });

  revalidate();
  return {
    success: true,
    message: "Teacher assessment created.",
    id: exam.id,
  };
}

export async function listTeacherAssessmentsAction(input: {
  academicYearId: string;
  employmentId?: string | null;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("assessment.results.enter");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  let query = supabase
    .from("exam_definitions")
    .select(
      "id, name, operational_kind, origin, max_marks, pass_marks, publishing_status, assessed_on, due_on, created_by_employment_id, created_at",
    )
    .eq("academic_year_id", input.academicYearId)
    .eq("origin", "teacher")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (input.employmentId) {
    query = query.eq("created_by_employment_id", input.employmentId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function listScheduledAssessmentsAction(input: {
  academicYearId: string;
  classId?: string;
  sectionId?: string;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("assessment.results.enter");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  let scheduleQuery = supabase
    .from("exam_subject_schedules")
    .select(
      "id, exam_definition_id, subject_id, class_id, section_id, max_marks, pass_marks, grading_type, scheduled_at, component_type",
    )
    .is("archived_at", null);

  if (input.classId) {
    scheduleQuery = scheduleQuery.eq("class_id", input.classId);
  }
  if (input.sectionId) {
    scheduleQuery = scheduleQuery.or(
      `section_id.eq.${input.sectionId},section_id.is.null`,
    );
  }

  const { data: schedules, error } = await scheduleQuery;
  if (error) {
    return { success: false, error: error.message };
  }

  const examIds = [
    ...new Set((schedules ?? []).map((s) => s.exam_definition_id)),
  ];
  if (!examIds.length) {
    return { success: true, rows: [] };
  }

  const { data: exams } = await supabase
    .from("exam_definitions")
    .select(
      "id, name, category, operational_kind, origin, publishing_status, academic_year_id, max_marks",
    )
    .in("id", examIds)
    .eq("academic_year_id", input.academicYearId)
    .is("archived_at", null)
    .in("publishing_status", ["scheduled", "published", "locked"]);

  const examMap = new Map((exams ?? []).map((e) => [e.id, e]));
  const rows = (schedules ?? [])
    .filter((s) => examMap.has(s.exam_definition_id))
    .map((s) => ({
      ...s,
      exam: examMap.get(s.exam_definition_id),
    }));

  return { success: true, rows };
}

/** Soft-archive a teacher-created assessment (no hard delete). */
export async function archiveTeacherAssessmentAction(
  examDefinitionId: string,
): Promise<AssessmentOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.results.enter");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const owned = await assertExamDefinitionOwned(
    supabase,
    schoolId,
    examDefinitionId,
  );
  if (!owned.ok) {
    return { success: false, error: "Assessment not found." };
  }

  const { data: exam } = await supabase
    .from("exam_definitions")
    .select("id, origin, publishing_status")
    .eq("id", examDefinitionId)
    .maybeSingle();

  if (!exam || exam.origin !== "teacher") {
    return {
      success: false,
      error: "Only teacher-created assessments can be archived here.",
    };
  }
  if (exam.publishing_status === "locked") {
    return { success: false, error: "Locked assessments cannot be archived." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("exam_definitions")
    .update({
      archived_at: now,
      updated_at: now,
      updated_by: actorId,
    })
    .eq("id", examDefinitionId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeAssessmentAudit(supabase, {
    schoolId,
    action: "assessment.teacher_archived",
    actorId,
    examDefinitionId,
  });

  revalidate();
  return { success: true, message: "Assessment archived.", id: examDefinitionId };
}
