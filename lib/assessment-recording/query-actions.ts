"use server";

import { assertRecordOwned } from "@/lib/assessment-recording/server-helpers";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listAssessmentRecordsAction(options?: {
  frameworkCategoryId?: string;
  sectionId?: string;
  subjectId?: string;
  includeArchived?: boolean;
}): Promise<
  | { success: true; records: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.read",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  let query = supabase
    .from("assessment_records")
    .select(
      "id, title, conducted_on, class_id, section_id, subject_id, framework_category_id, assessment_framework_version_id, max_marks, status, author_employment_id, locked_at, created_at",
    )
    .eq("school_id", schoolId)
    .order("conducted_on", { ascending: false });

  if (!options?.includeArchived) query = query.is("archived_at", null);
  if (options?.frameworkCategoryId) {
    query = query.eq("framework_category_id", options.frameworkCategoryId);
  }
  if (options?.sectionId) query = query.eq("section_id", options.sectionId);
  if (options?.subjectId) query = query.eq("subject_id", options.subjectId);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, records: data ?? [] };
}

export async function getAssessmentRecordAction(
  recordId: string,
): Promise<
  | {
      success: true;
      record: Record<string, unknown>;
      marks: Array<Record<string, unknown>>;
      topics: Array<Record<string, unknown>>;
      outcomes: Array<Record<string, unknown>>;
      attachments: Array<Record<string, unknown>>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.read",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertRecordOwned(supabase, schoolId, recordId, {
    allowArchived: true,
  });
  if (!owned.ok || !owned.row) {
    return { success: false, error: "Record not found" };
  }

  const [marks, topics, outcomes, attachments] = await Promise.all([
    supabase
      .from("assessment_record_marks")
      .select("*")
      .eq("record_id", recordId)
      .eq("school_id", schoolId)
      .eq("is_current", true)
      .is("superseded_at", null),
    supabase
      .from("assessment_record_topics")
      .select("*")
      .eq("record_id", recordId)
      .eq("school_id", schoolId)
      .is("archived_at", null),
    supabase
      .from("assessment_record_outcomes")
      .select("*")
      .eq("record_id", recordId)
      .eq("school_id", schoolId)
      .is("archived_at", null),
    supabase
      .from("assessment_record_attachments")
      .select("*")
      .eq("record_id", recordId)
      .eq("school_id", schoolId)
      .is("archived_at", null),
  ]);

  return {
    success: true,
    record: owned.row,
    marks: marks.data ?? [],
    topics: topics.data ?? [],
    outcomes: outcomes.data ?? [],
    attachments: attachments.data ?? [],
  };
}

export async function listMarkHistoryAction(
  recordId: string,
  studentProfileId: string,
): Promise<
  | { success: true; history: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.read",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertRecordOwned(supabase, schoolId, recordId, {
    allowArchived: true,
  });
  if (!owned.ok) return { success: false, error: "Record not found" };

  const { data, error } = await supabase
    .from("assessment_record_marks")
    .select("*")
    .eq("record_id", recordId)
    .eq("student_profile_id", studentProfileId)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, history: data ?? [] };
}
