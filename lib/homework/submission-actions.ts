"use server";

import { revalidatePath } from "next/cache";
import {
  assertEmploymentOwned,
  assertStudentInSchool,
  getActorId,
  loadHomework,
  writeHomeworkAudit,
} from "@/lib/homework/server-helpers";
import type {
  GradeSubmissionInput,
  HomeworkActionResult,
  RecordSubmissionInput,
} from "@/lib/homework/types";
import {
  computeIsLate,
  validateGradeSubmissionInput,
  validateRecordSubmissionInput,
} from "@/lib/homework/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/homework");
  revalidatePath("/dashboard/teacher");
}

/**
 * Teacher records a submission / receipt (student self-submit is FUTURE).
 */
export async function recordHomeworkSubmissionAction(
  input: RecordSubmissionInput,
): Promise<HomeworkActionResult> {
  const context = await getAuthenticatedSchoolContext("homework.grade");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateRecordSubmissionInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const homework = await loadHomework(supabase, schoolId, input.homeworkId);
  if (!homework) {
    return { success: false, error: "Homework not found." };
  }
  if (homework.status === "draft") {
    return {
      success: false,
      error: "Publish homework before recording submissions.",
    };
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

  const submittedAt =
    input.submittedAt ??
    (input.status === "not_submitted" || input.status === "draft"
      ? null
      : new Date().toISOString());

  const isLate = computeIsLate({
    submittedAt,
    dueOn: homework.due_on,
    dueAt: homework.due_at,
    allowLate: homework.allow_late,
    lateUntil: homework.late_until,
  });

  let status = input.status ?? (submittedAt ? "submitted" : "not_submitted");
  if (isLate && (status === "submitted" || status === "draft")) {
    status = "late";
  }
  if (!homework.allow_late && isLate && status !== "excused") {
    // still record as late for audit; teacher may excuse separately
    status = "late";
  }

  const gradeNow =
    Boolean(input.gradeNow) ||
    (input.marksAwarded != null && input.teacherFeedback != null);
  const now = new Date().toISOString();

  if (
    input.marksAwarded != null &&
    homework.max_marks != null &&
    input.marksAwarded > Number(homework.max_marks)
  ) {
    return {
      success: false,
      error: `Marks cannot exceed max (${homework.max_marks}).`,
      fieldErrors: { marksAwarded: "Exceeds max marks." },
    };
  }

  const { data: existing } = await supabase
    .from("homework_submissions")
    .select("id")
    .eq("homework_id", input.homeworkId)
    .eq("student_profile_id", input.studentProfileId)
    .is("archived_at", null)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    school_id: schoolId,
    homework_id: input.homeworkId,
    student_profile_id: input.studentProfileId,
    status: gradeNow ? "graded" : status,
    submitted_at: submittedAt,
    is_late: isLate,
    attachment_media_ids: input.attachmentMediaIds ?? [],
    student_notes: input.studentNotes?.trim() || null,
    recorded_by_teacher: true,
    updated_at: now,
  };

  if (input.marksAwarded != null || gradeNow) {
    payload.marks_awarded = input.marksAwarded ?? null;
  }
  if (input.teacherFeedback !== undefined || gradeNow) {
    payload.teacher_feedback = input.teacherFeedback?.trim() || null;
  }
  if (gradeNow) {
    payload.graded_at = now;
    payload.graded_by = actorId;
    payload.graded_by_employment_id = input.employmentId ?? null;
    payload.status = "graded";
  }

  let submissionId: string;
  if (existing) {
    const { error } = await supabase
      .from("homework_submissions")
      .update(payload)
      .eq("id", existing.id);
    if (error) {
      return { success: false, error: error.message };
    }
    submissionId = existing.id;
  } else {
    const { data: created, error } = await supabase
      .from("homework_submissions")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error || !created) {
      return {
        success: false,
        error: error?.message ?? "Failed to record submission.",
      };
    }
    submissionId = created.id;
  }

  await writeHomeworkAudit(supabase, {
    schoolId,
    action: gradeNow ? "submission.graded" : "submission.recorded",
    actorId,
    homeworkId: input.homeworkId,
    submissionId,
    studentProfileId: input.studentProfileId,
    newValues: {
      status: payload.status,
      is_late: isLate,
      marks_awarded: payload.marks_awarded ?? null,
    },
  });

  revalidate();
  return {
    success: true,
    message: gradeNow
      ? "Submission recorded and graded."
      : "Submission recorded.",
    id: submissionId,
  };
}

export async function gradeHomeworkSubmissionAction(
  input: GradeSubmissionInput,
): Promise<HomeworkActionResult> {
  const context = await getAuthenticatedSchoolContext("homework.grade");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateGradeSubmissionInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const { data: submission } = await supabase
    .from("homework_submissions")
    .select("id, homework_id, student_profile_id, school_id")
    .eq("id", input.submissionId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!submission) {
    return { success: false, error: "Submission not found." };
  }

  const homework = await loadHomework(
    supabase,
    schoolId,
    submission.homework_id as string,
  );
  if (
    homework?.max_marks != null &&
    input.marksAwarded > Number(homework.max_marks)
  ) {
    return {
      success: false,
      error: `Marks cannot exceed max (${homework.max_marks}).`,
      fieldErrors: { marksAwarded: "Exceeds max marks." },
    };
  }

  if (
    input.employmentId &&
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const now = new Date().toISOString();
  const status = input.status ?? "graded";
  const { error } = await supabase
    .from("homework_submissions")
    .update({
      marks_awarded: input.marksAwarded,
      teacher_feedback: input.teacherFeedback?.trim() || null,
      status,
      graded_at: now,
      graded_by: actorId,
      graded_by_employment_id: input.employmentId ?? null,
      returned_at: status === "returned" ? now : null,
      updated_at: now,
    })
    .eq("id", input.submissionId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeHomeworkAudit(supabase, {
    schoolId,
    action: "submission.graded",
    actorId,
    homeworkId: submission.homework_id as string,
    submissionId: input.submissionId,
    studentProfileId: submission.student_profile_id as string,
    newValues: {
      marks_awarded: input.marksAwarded,
      status,
    },
  });

  revalidate();
  return {
    success: true,
    message: "Submission graded.",
    id: input.submissionId,
  };
}

/**
 * Student self-submit — NOT BUILT (portal). Kept as explicit future surface.
 */
export async function submitHomeworkAsStudentAction(_input: {
  homeworkId: string;
  studentProfileId: string;
  attachmentMediaIds?: string[];
  studentNotes?: string | null;
}): Promise<HomeworkActionResult> {
  return {
    success: false,
    error:
      "Student self-submit is not available yet (portal FUTURE). Teachers can record submissions.",
  };
}

/**
 * Queue AI evaluation — schema flag only; E23 NOT BUILT.
 */
export async function requestHomeworkAiEvaluationAction(
  submissionId: string,
): Promise<HomeworkActionResult> {
  const context = await getAuthenticatedSchoolContext("homework.grade");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const { data: submission } = await supabase
    .from("homework_submissions")
    .select("id, homework_id")
    .eq("id", submissionId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!submission) {
    return { success: false, error: "Submission not found." };
  }

  const homework = await loadHomework(
    supabase,
    schoolId,
    submission.homework_id as string,
  );
  if (!homework?.ai_evaluation_enabled) {
    return {
      success: false,
      error: "AI evaluation is not enabled for this homework.",
    };
  }

  const { error } = await supabase
    .from("homework_submissions")
    .update({
      ai_evaluation_status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeHomeworkAudit(supabase, {
    schoolId,
    action: "submission.ai_evaluation_requested",
    actorId,
    homeworkId: submission.homework_id as string,
    submissionId,
    newValues: { ai_evaluation_status: "pending" },
  });

  return {
    success: true,
    message:
      "AI evaluation queued (runtime NOT BUILT — status set to pending).",
    id: submissionId,
  };
}
