"use server";

import { assertYearOwned } from "@/lib/assessment/server-helpers";
import type { MarksAnalyticsQuery } from "@/lib/assessment/ops-types";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listSessionMarksAction(input: {
  sessionId?: string;
  examDefinitionId?: string;
  subjectId?: string;
  sectionId?: string;
  includeSuperseded?: boolean;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("assessment.results.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("exam_results")
    .select(
      "id, mark_session_id, student_profile_id, exam_definition_id, subject_id, academic_year_id, marks_obtained, max_marks, grade_label, is_absent, teacher_remark, workflow_status, visible_to_guardians, visible_to_students, published_at, locked_at, is_correction, correction_of_id, superseded_at, correction_reason, created_at, updated_at",
    )
    .eq("school_id", schoolId)
    .order("updated_at", { ascending: false });

  if (!input.includeSuperseded) {
    query = query.is("superseded_at", null);
  }
  if (input.sessionId) {
    query = query.eq("mark_session_id", input.sessionId);
  }
  if (input.examDefinitionId) {
    query = query.eq("exam_definition_id", input.examDefinitionId);
  }
  if (input.subjectId) {
    query = query.eq("subject_id", input.subjectId);
  }
  if (input.sectionId) {
    query = query.eq("section_id", input.sectionId);
  }

  const { data, error } = await query.limit(2000);
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function listStudentMarksAction(input: {
  studentProfileId: string;
  academicYearId?: string;
  visibleOnly?: boolean;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("assessment.results.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("exam_results")
    .select(
      "id, exam_definition_id, subject_id, academic_year_id, marks_obtained, max_marks, grade_label, is_absent, teacher_remark, workflow_status, published_at, locked_at, visible_to_guardians, visible_to_students",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .is("superseded_at", null)
    .order("created_at", { ascending: false });

  if (input.academicYearId) {
    query = query.eq("academic_year_id", input.academicYearId);
  }
  if (input.visibleOnly) {
    query = query.or(
      "visible_to_guardians.eq.true,visible_to_students.eq.true",
    );
  }

  const { data, error } = await query.limit(500);
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function getMarksAnalyticsAction(
  input: MarksAnalyticsQuery,
): Promise<
  | {
      success: true;
      analytics: {
        total: number;
        absent: number;
        entered: number;
        averageMarks: number | null;
        passCount: number | null;
        byWorkflow: Record<string, number>;
      };
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("assessment.results.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  let query = supabase
    .from("exam_results")
    .select(
      "marks_obtained, max_marks, is_absent, workflow_status, student_profile_id",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .is("superseded_at", null);

  if (input.examDefinitionId) {
    query = query.eq("exam_definition_id", input.examDefinitionId);
  }
  if (input.subjectId) {
    query = query.eq("subject_id", input.subjectId);
  }
  if (input.sectionId) {
    query = query.eq("section_id", input.sectionId);
  }
  if (input.studentProfileId) {
    query = query.eq("student_profile_id", input.studentProfileId);
  }

  const { data, error } = await query.limit(5000);
  if (error) {
    return { success: false, error: error.message };
  }

  const rows = data ?? [];
  const byWorkflow: Record<string, number> = {};
  let sum = 0;
  let scored = 0;
  let absent = 0;
  let passCount = 0;
  let passEligible = 0;

  for (const r of rows) {
    const wf = (r.workflow_status as string) ?? "draft";
    byWorkflow[wf] = (byWorkflow[wf] ?? 0) + 1;
    if (r.is_absent) {
      absent += 1;
      continue;
    }
    if (r.marks_obtained != null) {
      sum += Number(r.marks_obtained);
      scored += 1;
      if (r.max_marks != null && Number(r.max_marks) > 0) {
        passEligible += 1;
        // Default 33% pass if no policy — analytics are derived only
        if (Number(r.marks_obtained) / Number(r.max_marks) >= 0.33) {
          passCount += 1;
        }
      }
    }
  }

  return {
    success: true,
    analytics: {
      total: rows.length,
      absent,
      entered: scored,
      averageMarks: scored ? Math.round((sum / scored) * 100) / 100 : null,
      passCount: passEligible ? passCount : null,
      byWorkflow,
    },
  };
}

export async function listAssessmentResultsAuditAction(input: {
  examDefinitionId?: string;
  sessionId?: string;
  studentProfileId?: string;
  limit?: number;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("assessment.results.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("assessment_results_audit_log")
    .select(
      "id, action, actor_id, mark_session_id, exam_result_id, exam_definition_id, student_profile_id, old_values, new_values, created_at",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);

  if (input.examDefinitionId) {
    query = query.eq("exam_definition_id", input.examDefinitionId);
  }
  if (input.sessionId) {
    query = query.eq("mark_session_id", input.sessionId);
  }
  if (input.studentProfileId) {
    query = query.eq("student_profile_id", input.studentProfileId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}
