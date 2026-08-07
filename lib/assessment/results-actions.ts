"use server";

import { revalidatePath } from "next/cache";
import {
  assertExamDefinitionOwned,
  assertSubjectOwned,
  assertYearOwned,
  getActorId,
} from "@/lib/assessment/server-helpers";
import {
  assertEmploymentOwned,
  assertSectionInSchool,
  assertStudentInSchool,
  getOrCreateMarkSession,
  resolveStudentPlacement,
  teacherMayEditMarks,
  visibilityForMarksWorkflow,
  writeAssessmentAudit,
} from "@/lib/assessment/ops-server-helpers";
import type {
  AssessmentOpsActionResult,
  BulkMarksInput,
  CorrectMarkInput,
  SingleMarkInput,
} from "@/lib/assessment/ops-types";
import {
  validateBulkMarksInput,
  validateCorrectMarkInput,
  validateSingleMarkInput,
} from "@/lib/assessment/ops-validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/assessments");
}

type Supabase = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

async function upsertCurrentMark(
  supabase: Supabase,
  input: {
    schoolId: string;
    sessionId: string;
    workflowStatus: string;
    examDefinitionId: string;
    subjectId: string;
    studentProfileId: string;
    academicYearId: string;
    marksObtained: number | null;
    maxMarks: number | null;
    gradeLabel: string | null;
    isAbsent: boolean;
    teacherRemark: string | null;
    sectionId: string | null;
    classId: string | null;
    scheduleId: string | null;
    componentId: string | null;
    studentAcademicYearId: string | null;
    gradingScaleVersionId: string | null;
    employmentId: string | null;
    actorId: string | null;
  },
): Promise<{ id: string } | { error: string }> {
  const vis = visibilityForMarksWorkflow(input.workflowStatus);

  let existingQuery = supabase
    .from("exam_results")
    .select("id, workflow_status, locked_at")
    .eq("student_profile_id", input.studentProfileId)
    .eq("exam_definition_id", input.examDefinitionId)
    .eq("subject_id", input.subjectId)
    .is("superseded_at", null);

  if (input.componentId) {
    existingQuery = existingQuery.eq(
      "assessment_component_id",
      input.componentId,
    );
  } else {
    existingQuery = existingQuery.is("assessment_component_id", null);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  const row = {
    school_id: input.schoolId,
    mark_session_id: input.sessionId,
    student_profile_id: input.studentProfileId,
    exam_definition_id: input.examDefinitionId,
    subject_id: input.subjectId,
    academic_year_id: input.academicYearId,
    student_academic_year_id: input.studentAcademicYearId,
    section_id: input.sectionId,
    class_id: input.classId,
    exam_subject_schedule_id: input.scheduleId,
    assessment_component_id: input.componentId,
    grading_scale_version_id: input.gradingScaleVersionId,
    marks_obtained: input.isAbsent ? null : input.marksObtained,
    max_marks: input.maxMarks,
    grade_label: input.gradeLabel,
    is_absent: input.isAbsent,
    teacher_remark: input.teacherRemark,
    entered_by: input.actorId,
    entered_by_employment_id: input.employmentId,
    workflow_status: input.workflowStatus,
    updated_at: new Date().toISOString(),
    ...vis,
  };

  if (existing) {
    if (
      !teacherMayEditMarks(
        existing.workflow_status as string,
        existing.locked_at as string | null,
      )
    ) {
      return {
        error:
          "Existing mark is locked — use correctMarkAction after Admin/HOD process.",
      };
    }

    const { data: updated, error } = await supabase
      .from("exam_results")
      .update(row)
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();

    if (error || !updated) {
      return { error: error?.message ?? "Failed to update mark." };
    }
    return { id: updated.id };
  }

  const { data: inserted, error } = await supabase
    .from("exam_results")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error || !inserted) {
    return { error: error?.message ?? "Failed to insert mark." };
  }
  return { id: inserted.id };
}

export async function upsertMarkAction(
  input: SingleMarkInput,
): Promise<AssessmentOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.results.enter");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateSingleMarkInput(input);
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
  const exam = await assertExamDefinitionOwned(
    supabase,
    schoolId,
    input.examDefinitionId,
  );
  if (!exam.ok) {
    return { success: false, error: "Assessment not found." };
  }
  if (!(await assertSubjectOwned(supabase, schoolId, input.subjectId))) {
    return { success: false, error: "Subject not found." };
  }
  if (
    !(await assertStudentInSchool(supabase, schoolId, input.studentProfileId))
  ) {
    return { success: false, error: "Student not found in this school." };
  }
  if (
    input.employmentId &&
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  let classId = input.classId ?? null;
  let sectionId = input.sectionId ?? null;
  if (sectionId) {
    const section = await assertSectionInSchool(supabase, schoolId, sectionId);
    if (!section) {
      return { success: false, error: "Section not found." };
    }
    classId = classId ?? section.classId;
  }

  const placement = await resolveStudentPlacement(
    supabase,
    schoolId,
    input.studentProfileId,
    input.academicYearId,
  );

  const session = await getOrCreateMarkSession(supabase, {
    schoolId,
    academicYearId: input.academicYearId,
    examDefinitionId: input.examDefinitionId,
    subjectId: input.subjectId,
    classId,
    sectionId,
    scheduleId: input.scheduleId,
    componentId: input.componentId,
    employmentId: input.employmentId,
  });
  if ("error" in session) {
    return { success: false, error: session.error };
  }
  if (!teacherMayEditMarks(session.workflow_status, session.locked_at)) {
    return {
      success: false,
      error: "Mark session is locked — teachers cannot edit.",
    };
  }

  const result = await upsertCurrentMark(supabase, {
    schoolId,
    sessionId: session.id,
    workflowStatus: session.workflow_status,
    examDefinitionId: input.examDefinitionId,
    subjectId: input.subjectId,
    studentProfileId: input.studentProfileId,
    academicYearId: input.academicYearId,
    marksObtained:
      input.marksObtained == null ? null : Number(input.marksObtained),
    maxMarks: input.maxMarks == null ? null : Number(input.maxMarks),
    gradeLabel: input.gradeLabel ?? null,
    isAbsent: Boolean(input.isAbsent),
    teacherRemark: input.teacherRemark ?? null,
    sectionId: sectionId ?? placement?.sectionId ?? null,
    classId: classId ?? placement?.classId ?? null,
    scheduleId: input.scheduleId ?? null,
    componentId: input.componentId ?? null,
    studentAcademicYearId:
      input.studentAcademicYearId ?? placement?.studentAcademicYearId ?? null,
    gradingScaleVersionId: input.gradingScaleVersionId ?? null,
    employmentId: input.employmentId ?? null,
    actorId,
  });

  if ("error" in result) {
    return { success: false, error: result.error };
  }

  await writeAssessmentAudit(supabase, {
    schoolId,
    action: "mark.upsert",
    actorId,
    markSessionId: session.id,
    examResultId: result.id,
    examDefinitionId: input.examDefinitionId,
    studentProfileId: input.studentProfileId,
    newValues: {
      marks_obtained: input.marksObtained,
      is_absent: input.isAbsent,
      teacher_remark: input.teacherRemark,
    },
  });

  revalidate();
  return {
    success: true,
    message: "Mark saved.",
    id: result.id,
    sessionId: session.id,
  };
}

export async function bulkUpsertMarksAction(
  input: BulkMarksInput,
): Promise<AssessmentOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.results.enter");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateBulkMarksInput(input);
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
  const exam = await assertExamDefinitionOwned(
    supabase,
    schoolId,
    input.examDefinitionId,
  );
  if (!exam.ok) {
    return { success: false, error: "Assessment not found." };
  }
  if (!(await assertSubjectOwned(supabase, schoolId, input.subjectId))) {
    return { success: false, error: "Subject not found." };
  }
  if (
    input.employmentId &&
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  let classId = input.classId ?? null;
  let sectionId = input.sectionId ?? null;
  if (sectionId) {
    const section = await assertSectionInSchool(supabase, schoolId, sectionId);
    if (!section) {
      return { success: false, error: "Section not found." };
    }
    classId = classId ?? section.classId;
  }

  const session = await getOrCreateMarkSession(supabase, {
    schoolId,
    academicYearId: input.academicYearId,
    examDefinitionId: input.examDefinitionId,
    subjectId: input.subjectId,
    classId,
    sectionId,
    scheduleId: input.scheduleId,
    componentId: input.componentId,
    employmentId: input.employmentId,
  });
  if ("error" in session) {
    return { success: false, error: session.error };
  }
  if (!teacherMayEditMarks(session.workflow_status, session.locked_at)) {
    return {
      success: false,
      error: "Mark session is locked — teachers cannot edit.",
    };
  }

  let saved = 0;
  for (const m of input.marks) {
    if (
      !(await assertStudentInSchool(supabase, schoolId, m.studentProfileId))
    ) {
      return {
        success: false,
        error: `Student ${m.studentProfileId} not found in this school.`,
      };
    }
    const placement = await resolveStudentPlacement(
      supabase,
      schoolId,
      m.studentProfileId,
      input.academicYearId,
    );
    const maxMarks =
      m.maxMarks != null
        ? Number(m.maxMarks)
        : input.defaultMaxMarks != null
          ? Number(input.defaultMaxMarks)
          : null;

    const result = await upsertCurrentMark(supabase, {
      schoolId,
      sessionId: session.id,
      workflowStatus: session.workflow_status,
      examDefinitionId: input.examDefinitionId,
      subjectId: input.subjectId,
      studentProfileId: m.studentProfileId,
      academicYearId: input.academicYearId,
      marksObtained: m.marksObtained == null ? null : Number(m.marksObtained),
      maxMarks,
      gradeLabel: m.gradeLabel ?? null,
      isAbsent: Boolean(m.isAbsent),
      teacherRemark: m.teacherRemark ?? null,
      sectionId: sectionId ?? placement?.sectionId ?? null,
      classId: classId ?? placement?.classId ?? null,
      scheduleId: input.scheduleId ?? null,
      componentId: input.componentId ?? null,
      studentAcademicYearId:
        m.studentAcademicYearId ?? placement?.studentAcademicYearId ?? null,
      gradingScaleVersionId: null,
      employmentId: input.employmentId ?? null,
      actorId,
    });

    if ("error" in result) {
      return { success: false, error: result.error };
    }
    saved += 1;
  }

  await writeAssessmentAudit(supabase, {
    schoolId,
    action: "mark.bulk_upsert",
    actorId,
    markSessionId: session.id,
    examDefinitionId: input.examDefinitionId,
    newValues: { count: saved },
  });

  revalidate();
  return {
    success: true,
    message: `Saved ${saved} mark(s).`,
    sessionId: session.id,
  };
}

/**
 * Compensating correction after lock (or when Admin forces rewrite of meaning).
 * Supersedes the current row; inserts a new current fact + audit.
 */
export async function correctMarkAction(
  input: CorrectMarkInput,
): Promise<AssessmentOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("assessment.results.enter");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateCorrectMarkInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const { data: original } = await supabase
    .from("exam_results")
    .select("*")
    .eq("id", input.examResultId)
    .eq("school_id", schoolId)
    .is("superseded_at", null)
    .maybeSingle();

  if (!original) {
    return { success: false, error: "Current result not found." };
  }

  const now = new Date().toISOString();
  const { error: supersedeError } = await supabase
    .from("exam_results")
    .update({ superseded_at: now, updated_at: now })
    .eq("id", original.id);

  if (supersedeError) {
    return { success: false, error: supersedeError.message };
  }

  const vis = visibilityForMarksWorkflow(
    (original.workflow_status as string) ?? "locked",
  );

  const { data: correction, error } = await supabase
    .from("exam_results")
    .insert({
      school_id: schoolId,
      mark_session_id: original.mark_session_id,
      student_profile_id: original.student_profile_id,
      exam_definition_id: original.exam_definition_id,
      subject_id: original.subject_id,
      academic_year_id: original.academic_year_id,
      student_academic_year_id: original.student_academic_year_id,
      section_id: original.section_id,
      class_id: original.class_id,
      exam_subject_schedule_id: original.exam_subject_schedule_id,
      assessment_component_id: original.assessment_component_id,
      grading_scale_version_id: original.grading_scale_version_id,
      marks_obtained: input.isAbsent
        ? null
        : input.marksObtained == null
          ? original.marks_obtained
          : Number(input.marksObtained),
      max_marks:
        input.maxMarks == null ? original.max_marks : Number(input.maxMarks),
      grade_label:
        input.gradeLabel === undefined
          ? original.grade_label
          : input.gradeLabel,
      is_absent:
        input.isAbsent === undefined ? original.is_absent : input.isAbsent,
      teacher_remark:
        input.teacherRemark === undefined
          ? original.teacher_remark
          : input.teacherRemark,
      entered_by: actorId,
      entered_by_employment_id: original.entered_by_employment_id,
      workflow_status: original.workflow_status,
      published_at: original.published_at,
      locked_at: original.locked_at,
      locked_by: original.locked_by,
      correction_of_id: original.id,
      is_correction: true,
      correction_reason: input.reason.trim(),
      ...vis,
    })
    .select("id")
    .maybeSingle();

  if (error || !correction) {
    // Best-effort rollback supersede so unique index remains usable
    await supabase
      .from("exam_results")
      .update({ superseded_at: null, updated_at: now })
      .eq("id", original.id);
    return {
      success: false,
      error: error?.message ?? "Failed to write correction.",
    };
  }

  await writeAssessmentAudit(supabase, {
    schoolId,
    action: "mark.correct",
    actorId,
    markSessionId: original.mark_session_id,
    examResultId: correction.id,
    examDefinitionId: original.exam_definition_id,
    studentProfileId: original.student_profile_id,
    oldValues: {
      marks_obtained: original.marks_obtained,
      grade_label: original.grade_label,
      is_absent: original.is_absent,
    },
    newValues: {
      marks_obtained: input.marksObtained,
      grade_label: input.gradeLabel,
      is_absent: input.isAbsent,
      reason: input.reason,
      correction_of_id: original.id,
    },
  });

  revalidate();
  return {
    success: true,
    message: "Correction recorded (prior row superseded).",
    id: correction.id,
    sessionId: original.mark_session_id ?? undefined,
  };
}
