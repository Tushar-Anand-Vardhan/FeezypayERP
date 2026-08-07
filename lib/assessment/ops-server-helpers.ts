import type { createClient } from "@/lib/supabase/server";
import {
  teacherMayEditMarks,
  visibilityForMarksWorkflow,
} from "@/lib/assessment/ops-validation";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export { teacherMayEditMarks, visibilityForMarksWorkflow };

export async function assertSectionInSchool(
  supabase: Supabase,
  schoolId: string,
  sectionId: string,
): Promise<{ classId: string; academicYearId: string } | null> {
  const { data: section } = await supabase
    .from("sections")
    .select("id, class_id")
    .eq("id", sectionId)
    .maybeSingle();
  if (!section) return null;

  const { data: klass } = await supabase
    .from("classes")
    .select("id, academic_year_id")
    .eq("id", section.class_id)
    .maybeSingle();
  if (!klass) return null;

  const { data: year } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", klass.academic_year_id)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!year) return null;

  return {
    classId: klass.id,
    academicYearId: klass.academic_year_id,
  };
}

export async function assertStudentInSchool(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("student_admissions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .maybeSingle();
  return Boolean(data);
}

export async function assertEmploymentOwned(
  supabase: Supabase,
  schoolId: string,
  employmentId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("teacher_employments")
    .select("id")
    .eq("id", employmentId)
    .eq("school_id", schoolId)
    .eq("status", "active")
    .maybeSingle();
  return Boolean(data);
}

export async function writeAssessmentAudit(
  supabase: Supabase,
  input: {
    schoolId: string;
    action: string;
    actorId?: string | null;
    markSessionId?: string | null;
    examResultId?: string | null;
    examDefinitionId?: string | null;
    studentProfileId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  },
): Promise<void> {
  await supabase.from("assessment_results_audit_log").insert({
    school_id: input.schoolId,
    action: input.action,
    actor_id: input.actorId ?? null,
    mark_session_id: input.markSessionId ?? null,
    exam_result_id: input.examResultId ?? null,
    exam_definition_id: input.examDefinitionId ?? null,
    student_profile_id: input.studentProfileId ?? null,
    old_values: input.oldValues ?? null,
    new_values: input.newValues ?? null,
  });
}

export async function getOrCreateMarkSession(
  supabase: Supabase,
  input: {
    schoolId: string;
    academicYearId: string;
    examDefinitionId: string;
    subjectId: string;
    classId?: string | null;
    sectionId?: string | null;
    scheduleId?: string | null;
    componentId?: string | null;
    employmentId?: string | null;
  },
): Promise<{ id: string; workflow_status: string; locked_at: string | null } | { error: string }> {
  let query = supabase
    .from("assessment_mark_sessions")
    .select("id, workflow_status, locked_at")
    .eq("exam_definition_id", input.examDefinitionId)
    .eq("subject_id", input.subjectId)
    .eq("school_id", input.schoolId);

  if (input.sectionId) {
    query = query.eq("section_id", input.sectionId);
  } else {
    query = query.is("section_id", null);
  }
  if (input.classId) {
    query = query.eq("class_id", input.classId);
  } else {
    query = query.is("class_id", null);
  }
  if (input.componentId) {
    query = query.eq("assessment_component_id", input.componentId);
  } else {
    query = query.is("assessment_component_id", null);
  }

  const { data: existing } = await query.maybeSingle();
  if (existing) {
    return existing;
  }

  const { data: inserted, error } = await supabase
    .from("assessment_mark_sessions")
    .insert({
      school_id: input.schoolId,
      academic_year_id: input.academicYearId,
      exam_definition_id: input.examDefinitionId,
      subject_id: input.subjectId,
      class_id: input.classId ?? null,
      section_id: input.sectionId ?? null,
      exam_subject_schedule_id: input.scheduleId ?? null,
      assessment_component_id: input.componentId ?? null,
      entered_by_employment_id: input.employmentId ?? null,
      workflow_status: "draft",
    })
    .select("id, workflow_status, locked_at")
    .maybeSingle();

  if (error || !inserted) {
    return { error: error?.message ?? "Failed to create mark session." };
  }
  return inserted;
}

export async function assertTeacherCanEditMarkSession(
  supabase: Supabase,
  schoolId: string,
  sessionId: string,
): Promise<
  | { ok: true; session: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const { data: session } = await supabase
    .from("assessment_mark_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!session) {
    return { ok: false, error: "Mark session not found." };
  }
  if (
    !teacherMayEditMarks(
      session.workflow_status as string,
      session.locked_at as string | null,
    )
  ) {
    return {
      ok: false,
      error: "Marks are locked — corrections require Admin/HOD unlock or correctMarkAction.",
    };
  }
  return { ok: true, session };
}

export async function resolveStudentPlacement(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
  academicYearId: string,
): Promise<{
  studentAcademicYearId: string;
  classId: string | null;
  sectionId: string | null;
} | null> {
  const { data: admission } = await supabase
    .from("student_admissions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .maybeSingle();
  if (!admission) return null;

  const { data: say } = await supabase
    .from("student_academic_years")
    .select("id, class_id, section_id")
    .eq("admission_id", admission.id)
    .eq("academic_year_id", academicYearId)
    .eq("status", "active")
    .is("left_on", null)
    .maybeSingle();

  if (!say) return null;
  return {
    studentAcademicYearId: say.id,
    classId: say.class_id,
    sectionId: say.section_id,
  };
}
