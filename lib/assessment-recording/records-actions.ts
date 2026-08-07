"use server";

import { writeRecordingAudit } from "@/lib/assessment-recording/audit";
import {
  assertCategoryOnFramework,
  assertFrameworkVersion,
  assertRecordOwned,
  assertSectionInSchool,
  getActorId,
  recordIsEditable,
} from "@/lib/assessment-recording/server-helpers";
import type {
  AssessmentRecordInput,
  RecordingActionResult,
} from "@/lib/assessment-recording/types";
import { validateRecordInput } from "@/lib/assessment-recording/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function createAssessmentRecordAction(
  input: AssessmentRecordInput,
): Promise<RecordingActionResult> {
  const fieldErrors = validateRecordInput(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.create",
    { subjectId: input.subjectId, sectionId: input.sectionId },
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;

  const { data: fw } = await supabase
    .from("assessment_frameworks")
    .select("id, class_id, subject_id, status, academic_year_id")
    .eq("id", input.assessmentFrameworkId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  if (!fw) return { success: false, error: "Framework not found" };
  if (fw.status === "retired") {
    return { success: false, error: "Framework is retired" };
  }
  if (fw.class_id !== input.classId || fw.subject_id !== input.subjectId) {
    return {
      success: false,
      error: "Class/subject must match the assessment framework",
    };
  }
  if (fw.academic_year_id !== input.academicYearId) {
    return { success: false, error: "Academic year must match the framework" };
  }

  if (
    !(await assertFrameworkVersion(
      supabase,
      input.assessmentFrameworkId,
      input.assessmentFrameworkVersionId,
    ))
  ) {
    return { success: false, error: "Framework version not found" };
  }

  if (
    !(await assertCategoryOnFramework(
      supabase,
      schoolId,
      input.assessmentFrameworkId,
      input.frameworkCategoryId,
    ))
  ) {
    return { success: false, error: "Category not on this framework" };
  }

  const section = await assertSectionInSchool(
    supabase,
    schoolId,
    input.sectionId,
  );
  if (!section.ok || section.classId !== input.classId) {
    return { success: false, error: "Section does not belong to class" };
  }

  const actorId = await getActorId(supabase);
  const row = {
    school_id: schoolId,
    academic_year_id: input.academicYearId,
    assessment_framework_id: input.assessmentFrameworkId,
    assessment_framework_version_id: input.assessmentFrameworkVersionId,
    framework_category_id: input.frameworkCategoryId,
    title: input.title.trim(),
    conducted_on: input.conductedOn,
    description: input.description?.trim() || null,
    class_id: input.classId,
    section_id: input.sectionId,
    subject_id: input.subjectId,
    max_marks: input.maxMarks,
    status: input.status ?? "draft",
    author_employment_id: input.authorEmploymentId,
    created_by: actorId,
    updated_by: actorId,
  };

  const { data, error } = await supabase
    .from("assessment_records")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data?.id) return { success: false, error: "Insert failed" };

  await writeRecordingAudit(supabase, {
    schoolId,
    action: "record.create",
    entityType: "assessment_record",
    entityId: data.id,
    actorAuthUserId: actorId,
    newValues: row,
  });

  return { success: true, id: data.id };
}

export async function updateAssessmentRecordAction(
  recordId: string,
  patch: Partial<{
    title: string;
    conductedOn: string;
    description: string | null;
    maxMarks: number;
    status: "draft" | "open";
  }>,
): Promise<RecordingActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertRecordOwned(supabase, schoolId, recordId);
  if (!owned.ok) return { success: false, error: "Record not found" };
  if (!recordIsEditable(owned.status)) {
    return { success: false, error: "Record is locked" };
  }

  if (patch.maxMarks != null && !(patch.maxMarks > 0)) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: { maxMarks: "Must be > 0" },
    };
  }

  const actorId = await getActorId(supabase);
  const update: Record<string, unknown> = {
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };
  if (patch.title != null) update.title = patch.title.trim();
  if (patch.conductedOn != null) update.conducted_on = patch.conductedOn;
  if (patch.description !== undefined) {
    update.description = patch.description?.trim() || null;
  }
  if (patch.maxMarks != null) update.max_marks = patch.maxMarks;
  if (patch.status != null) update.status = patch.status;

  const { error } = await supabase
    .from("assessment_records")
    .update(update)
    .eq("id", recordId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };

  await writeRecordingAudit(supabase, {
    schoolId,
    action: "record.update",
    entityType: "assessment_record",
    entityId: recordId,
    actorAuthUserId: actorId,
    oldValues: owned.row,
    newValues: update,
  });

  return { success: true, id: recordId };
}

export async function archiveAssessmentRecordAction(
  recordId: string,
): Promise<RecordingActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertRecordOwned(supabase, schoolId, recordId);
  if (!owned.ok) return { success: false, error: "Record not found" };
  if (!recordIsEditable(owned.status)) {
    return { success: false, error: "Locked records cannot be archived by teacher edit; unlock first" };
  }

  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("assessment_records")
    .update({ archived_at: now, updated_by: actorId, updated_at: now })
    .eq("id", recordId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };

  await writeRecordingAudit(supabase, {
    schoolId,
    action: "record.archive",
    entityType: "assessment_record",
    entityId: recordId,
    actorAuthUserId: actorId,
  });
  return { success: true, id: recordId };
}

export async function lockAssessmentRecordAction(
  recordId: string,
): Promise<RecordingActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.lock",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertRecordOwned(supabase, schoolId, recordId);
  if (!owned.ok) return { success: false, error: "Record not found" };
  if (owned.status === "locked") {
    return { success: false, error: "Already locked" };
  }

  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("assessment_records")
    .update({
      status: "locked",
      locked_at: now,
      locked_by: actorId,
      updated_by: actorId,
      updated_at: now,
    })
    .eq("id", recordId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };

  await writeRecordingAudit(supabase, {
    schoolId,
    action: "record.lock",
    entityType: "assessment_record",
    entityId: recordId,
    actorAuthUserId: actorId,
  });
  return { success: true, id: recordId };
}

export async function unlockAssessmentRecordAction(
  recordId: string,
): Promise<RecordingActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.unlock",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertRecordOwned(supabase, schoolId, recordId);
  if (!owned.ok) return { success: false, error: "Record not found" };

  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("assessment_records")
    .update({
      status: "open",
      locked_at: null,
      locked_by: null,
      updated_by: actorId,
      updated_at: now,
    })
    .eq("id", recordId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };

  await writeRecordingAudit(supabase, {
    schoolId,
    action: "record.unlock",
    entityType: "assessment_record",
    entityId: recordId,
    actorAuthUserId: actorId,
  });
  return { success: true, id: recordId };
}
