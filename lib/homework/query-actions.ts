"use server";

import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listHomeworkAction(input: {
  academicYearId: string;
  sectionId?: string;
  classId?: string;
  employmentId?: string;
  assignmentKind?: string;
  status?: string;
  /** Parent portal: only parent_visible + assigned */
  parentVisibleOnly?: boolean;
  /** Student portal: only visible_to_students + assigned */
  studentVisibleOnly?: boolean;
  includeArchived?: boolean;
  limit?: number;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("homework.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("homework_assignments")
    .select(
      "id, academic_year_id, employment_id, section_id, class_id, subject_id, assignment_kind, title, description, instructions, assigned_on, due_on, due_at, max_marks, allow_late, late_until, attachment_media_ids, parent_visible, visible_to_students, status, published_at, closed_at, ai_evaluation_enabled, ai_evaluation_status, created_at, updated_at",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .order("due_on", { ascending: true, nullsFirst: false })
    .limit(input.limit ?? 200);

  if (!input.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (input.sectionId) {
    query = query.eq("section_id", input.sectionId);
  }
  if (input.classId) {
    query = query.eq("class_id", input.classId);
  }
  if (input.employmentId) {
    query = query.eq("employment_id", input.employmentId);
  }
  if (input.assignmentKind) {
    query = query.eq("assignment_kind", input.assignmentKind);
  }
  if (input.status) {
    query = query.eq("status", input.status);
  }
  if (input.parentVisibleOnly) {
    query = query
      .eq("parent_visible", true)
      .eq("status", "assigned");
  }
  if (input.studentVisibleOnly) {
    query = query
      .eq("visible_to_students", true)
      .in("status", ["assigned", "closed"]);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function getHomeworkAction(homeworkId: string): Promise<
  | {
      success: true;
      homework: Record<string, unknown>;
      submissions: Array<Record<string, unknown>>;
      summary: {
        total: number;
        submitted: number;
        late: number;
        graded: number;
        notSubmitted: number;
      };
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("homework.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: homework, error } = await supabase
    .from("homework_assignments")
    .select("*")
    .eq("id", homeworkId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error || !homework) {
    return { success: false, error: error?.message ?? "Homework not found." };
  }

  const { data: submissions } = await supabase
    .from("homework_submissions")
    .select(
      "id, student_profile_id, status, submitted_at, is_late, attachment_media_ids, student_notes, recorded_by_teacher, marks_awarded, teacher_feedback, graded_at, ai_evaluation_status, created_at, updated_at",
    )
    .eq("school_id", schoolId)
    .eq("homework_id", homeworkId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);

  const rows = submissions ?? [];
  const summary = {
    total: rows.length,
    submitted: rows.filter((r) =>
      ["submitted", "late", "returned", "graded"].includes(r.status as string),
    ).length,
    late: rows.filter((r) => r.is_late === true || r.status === "late").length,
    graded: rows.filter((r) => r.status === "graded" || r.status === "returned")
      .length,
    notSubmitted: rows.filter((r) => r.status === "not_submitted").length,
  };

  return { success: true, homework, submissions: rows, summary };
}

export async function listHomeworkSubmissionsAction(input: {
  homeworkId?: string;
  studentProfileId?: string;
  status?: string;
  limit?: number;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("homework.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  let query = context.supabase
    .from("homework_submissions")
    .select(
      "id, homework_id, student_profile_id, status, submitted_at, is_late, marks_awarded, teacher_feedback, graded_at, ai_evaluation_status, recorded_by_teacher, created_at",
    )
    .eq("school_id", context.schoolId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(input.limit ?? 200);

  if (input.homeworkId) {
    query = query.eq("homework_id", input.homeworkId);
  }
  if (input.studentProfileId) {
    query = query.eq("student_profile_id", input.studentProfileId);
  }
  if (input.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function listStudentHomeworkAction(input: {
  studentProfileId: string;
  academicYearId: string;
  /** When true, only parent_visible items (parent portal) */
  forParent?: boolean;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("homework.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  // Resolve student's section(s) for the year
  const { data: admissions } = await supabase
    .from("student_admissions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("student_profile_id", input.studentProfileId);

  const admissionIds = (admissions ?? []).map((a) => a.id as string);
  if (!admissionIds.length) {
    return { success: true, rows: [] };
  }

  const { data: placements } = await supabase
    .from("student_academic_years")
    .select("section_id, class_id")
    .eq("academic_year_id", input.academicYearId)
    .in("admission_id", admissionIds)
    .eq("status", "active")
    .is("left_on", null);

  const sectionIds = [
    ...new Set((placements ?? []).map((p) => p.section_id as string)),
  ];
  if (!sectionIds.length) {
    return { success: true, rows: [] };
  }

  let query = supabase
    .from("homework_assignments")
    .select(
      "id, assignment_kind, title, description, due_on, due_at, max_marks, allow_late, late_until, attachment_media_ids, parent_visible, visible_to_students, status, subject_id, section_id, published_at",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .in("section_id", sectionIds)
    .in("status", ["assigned", "closed"])
    .is("archived_at", null)
    .order("due_on", { ascending: true });

  if (input.forParent) {
    query = query.eq("parent_visible", true);
  } else {
    query = query.eq("visible_to_students", true);
  }

  const { data: homework, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  const homeworkIds = (homework ?? []).map((h) => h.id as string);
  let submissionMap = new Map<string, Record<string, unknown>>();
  if (homeworkIds.length) {
    const { data: submissions } = await supabase
      .from("homework_submissions")
      .select(
        "homework_id, status, submitted_at, is_late, marks_awarded, teacher_feedback, graded_at",
      )
      .eq("student_profile_id", input.studentProfileId)
      .in("homework_id", homeworkIds)
      .is("archived_at", null);
    for (const s of submissions ?? []) {
      submissionMap.set(s.homework_id as string, s);
    }
  }

  const rows = (homework ?? []).map((h) => ({
    ...h,
    submission: submissionMap.get(h.id as string) ?? null,
  }));

  return { success: true, rows };
}

export async function listHomeworkAuditAction(
  homeworkId: string,
): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("homework.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { data, error } = await context.supabase
    .from("homework_audit_log")
    .select(
      "id, action, actor_id, submission_id, student_profile_id, old_values, new_values, created_at",
    )
    .eq("school_id", context.schoolId)
    .eq("homework_id", homeworkId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}
