"use server";

import { revalidatePath } from "next/cache";
import { getOnboardingProgress } from "@/lib/onboarding/progress";
import {
  getActiveYearClassesForSchool,
  verifyOwnedClassIds,
} from "@/lib/onboarding/school-classes-server";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import {
  trimExamRows,
  validateExamRows,
  type ExamFormRow,
} from "@/lib/onboarding/exams";

type Result =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type ExamsStepData =
  | {
      success: true;
      blocked: false;
      terms: Array<{ id: string; name: string }>;
      classes: Array<{ id: string; name: string }>;
      exams: ExamFormRow[];
    }
  | {
      success: true;
      blocked: true;
      reason: "prerequisites" | "terms" | "classes";
    }
  | { success: false; error: string };

export type ReviewStepData =
  | {
      success: true;
      schoolName: string;
      counts: {
        classes: number;
        sections: number;
        subjects: number;
        houses: number;
        clubs: number;
        teachers: number;
        students: number;
        exams: number;
      };
      timetableSkipped: boolean;
      timetableConfigured: boolean;
    }
  | { success: false; error: string };

export async function getExamsStepDataAction(): Promise<ExamsStepData> {
  const context = await getAuthenticatedSchoolContext("onboarding.wizard.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const classesResult = await getActiveYearClassesForSchool(supabase, schoolId);
  if ("error" in classesResult) {
    return { success: false, error: classesResult.error };
  }
  if ("blocked" in classesResult) {
    if (classesResult.reason === "no_classes") {
      return { success: true, blocked: true, reason: "classes" };
    }
    return { success: true, blocked: true, reason: "prerequisites" };
  }

  const [{ data: terms }, { data: exams }] = await Promise.all([
    supabase
      .from("terms")
      .select("id, name")
      .eq("academic_year_id", classesResult.academicYear.id)
      .order("start_month"),
    supabase
      .from("exam_definitions")
      .select(
        "class_id, name, category, term_id, weightage_percent, max_marks, grading_type",
      )
      .eq("academic_year_id", classesResult.academicYear.id)
      .is("archived_at", null)
      .order("name"),
  ]);

  if (!terms || terms.length === 0) {
    return { success: true, blocked: true, reason: "terms" };
  }

  const fallbackClassId = classesResult.classes[0]?.id ?? "";

  return {
    success: true,
    blocked: false,
    terms,
    classes: classesResult.classes.map((row) => ({
      id: row.id,
      name: row.name,
    })),
    exams: (exams ?? []).map((exam) => ({
      classId: exam.class_id ?? fallbackClassId,
      name: exam.name,
      category: exam.category as ExamFormRow["category"],
      termId: exam.term_id ?? "",
      weightagePercent:
        exam.weightage_percent === null || exam.weightage_percent === undefined
          ? ""
          : String(exam.weightage_percent),
      maxMarks:
        exam.max_marks === null || exam.max_marks === undefined
          ? ""
          : String(exam.max_marks),
      gradingType:
        (exam.grading_type as ExamFormRow["gradingType"] | null) ?? "marks",
    })),
  };
}

export async function saveExamsAction(formData: FormData): Promise<Result> {
  const context = await getAuthenticatedSchoolContext("onboarding.wizard.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const intent = String(formData.get("intent") ?? "save");

  let rows: ExamFormRow[] = [];
  try {
    rows = JSON.parse(String(formData.get("exams") ?? "[]")) as ExamFormRow[];
  } catch {
    return { success: false, error: "Could not read exam data." };
  }

  const classesResult = await getActiveYearClassesForSchool(supabase, schoolId);
  if ("error" in classesResult) {
    return { success: false, error: classesResult.error };
  }
  if ("blocked" in classesResult) {
    return {
      success: false,
      error:
        classesResult.reason === "no_classes"
          ? "Add at least one class before configuring exams."
          : "Complete School Identity and Terms first.",
    };
  }

  const classIds = new Set(classesResult.classes.map((row) => row.id));
  const fieldErrors = validateExamRows(rows, {
    requireAtLeastOne: intent === "next",
    classIds,
  });
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const trimmed = trimExamRows(rows);
  const owned = await verifyOwnedClassIds(
    supabase,
    classesResult.academicYear.id,
    [...new Set(trimmed.map((row) => row.classId))],
  );
  if ("error" in owned) {
    return { success: false, error: owned.error };
  }

  if (intent === "save" && trimmed.length === 0) {
    const { count } = await supabase
      .from("exam_definitions")
      .select("id", { count: "exact", head: true })
      .eq("academic_year_id", classesResult.academicYear.id)
      .is("archived_at", null);
    if ((count ?? 0) > 0) {
      return {
        success: false,
        error:
          "Saving would remove all exams. Keep at least one exam on Save & exit.",
      };
    }
  }

  // Soft-archive existing definitions (E11 prefers archive; DELETE revoked).
  const { error: archiveError } = await supabase
    .from("exam_definitions")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("academic_year_id", classesResult.academicYear.id)
    .is("archived_at", null);
  if (archiveError) {
    return { success: false, error: archiveError.message };
  }

  if (trimmed.length > 0) {
    const { error } = await supabase.from("exam_definitions").insert(
      trimmed.map((row) => ({
        academic_year_id: classesResult.academicYear.id,
        class_id: row.classId,
        term_id: row.termId || null,
        name: row.name,
        category: row.category,
        weightage_percent: row.weightagePercent
          ? Number(row.weightagePercent)
          : null,
        max_marks: row.maxMarks ? Number(row.maxMarks) : null,
        grading_type: row.gradingType || "marks",
        publishing_status: "draft",
      })),
    );
    if (error) {
      return { success: false, error: error.message };
    }
  }

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "Exam definitions saved." };
}

export async function getReviewStepDataAction(): Promise<ReviewStepData> {
  const context = await getAuthenticatedSchoolContext("onboarding.wizard.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();

  const progress = await getOnboardingProgress(supabase, schoolId);
  if ("error" in progress) {
    return { success: false, error: progress.error };
  }

  return {
    success: true,
    schoolName: school?.name ?? "Your school",
    counts: progress.counts,
    timetableSkipped: progress.timetableSkipped,
    timetableConfigured: progress.timetableConfigured,
  };
}

export async function completeOnboardingAction(): Promise<Result> {
  const context = await getAuthenticatedSchoolContext("onboarding.wizard.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const progress = await getOnboardingProgress(supabase, schoolId);
  if ("error" in progress) {
    return { success: false, error: progress.error };
  }

  if (
    progress.counts.classes < 1 ||
    progress.counts.sections < 1 ||
    progress.counts.subjects < 1 ||
    progress.counts.teachers < 1 ||
    progress.counts.students < 1 ||
    progress.counts.exams < 1
  ) {
    return {
      success: false,
      error:
        "Finish required steps (classes, sections, subjects, staff, students, exams) before confirming.",
    };
  }

  if (!progress.timetableConfigured && !progress.timetableSkipped) {
    return {
      success: false,
      error:
        "Configure the timetable or choose Skip for now before confirming.",
    };
  }

  const { error } = await supabase
    .from("schools")
    .update({
      onboarding_status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/onboarding", "layout");
  revalidatePath("/dashboard");
  return { success: true, message: "Onboarding completed." };
}
