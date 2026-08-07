"use server";

import { writeRecordingAudit } from "@/lib/assessment-recording/audit";
import {
  assertRecordOwned,
  getActorId,
  recordIsEditable,
} from "@/lib/assessment-recording/server-helpers";
import type {
  BulkMarksInput,
  MarkEntryInput,
  RecordingActionResult,
} from "@/lib/assessment-recording/types";
import {
  validateBulkMarks,
  validateMarkEntry,
} from "@/lib/assessment-recording/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

type Supabase = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

async function supersedeMark(
  supabase: Supabase,
  input: {
    schoolId: string;
    recordId: string;
    studentProfileId: string;
    marksObtained: number | null;
    isAbsent: boolean;
    remarks: string | null;
    employmentId: string;
    actorId: string | null;
  },
): Promise<{ id: string } | { error: string }> {
  const { data: current } = await supabase
    .from("assessment_record_marks")
    .select("id, marks_obtained, remarks, is_absent")
    .eq("record_id", input.recordId)
    .eq("student_profile_id", input.studentProfileId)
    .eq("is_current", true)
    .is("superseded_at", null)
    .maybeSingle();

  const now = new Date().toISOString();
  if (current?.id) {
    const { error: archErr } = await supabase
      .from("assessment_record_marks")
      .update({ is_current: false, superseded_at: now })
      .eq("id", current.id);
    if (archErr) return { error: archErr.message };
  }

  const { data, error } = await supabase
    .from("assessment_record_marks")
    .insert({
      school_id: input.schoolId,
      record_id: input.recordId,
      student_profile_id: input.studentProfileId,
      marks_obtained: input.isAbsent ? null : input.marksObtained,
      is_absent: input.isAbsent,
      remarks: input.remarks,
      is_current: true,
      supersedes_mark_id: current?.id ?? null,
      entered_by_employment_id: input.employmentId,
      created_by: input.actorId,
    })
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data?.id) return { error: "Mark insert failed" };
  return { id: data.id };
}

export async function enterMarkAction(
  input: MarkEntryInput,
): Promise<RecordingActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.enter_marks",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertRecordOwned(supabase, schoolId, input.recordId);
  if (!owned.ok || owned.maxMarks == null) {
    return { success: false, error: "Record not found" };
  }
  if (!recordIsEditable(owned.status)) {
    return { success: false, error: "Record is locked" };
  }

  const fieldErrors = validateMarkEntry(input, owned.maxMarks);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const actorId = await getActorId(supabase);
  const result = await supersedeMark(supabase, {
    schoolId,
    recordId: input.recordId,
    studentProfileId: input.studentProfileId,
    marksObtained: input.marksObtained ?? null,
    isAbsent: input.isAbsent ?? false,
    remarks: input.remarks?.trim() || null,
    employmentId: input.enteredByEmploymentId,
    actorId,
  });
  if ("error" in result) return { success: false, error: result.error };

  await writeRecordingAudit(supabase, {
    schoolId,
    action: "mark.enter",
    entityType: "assessment_record_mark",
    entityId: result.id,
    actorAuthUserId: actorId,
    newValues: {
      student_profile_id: input.studentProfileId,
      marks_obtained: input.marksObtained,
      is_absent: input.isAbsent ?? false,
    },
  });

  return { success: true, id: result.id };
}

export async function bulkEnterMarksAction(
  input: BulkMarksInput,
): Promise<RecordingActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.enter_marks",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertRecordOwned(supabase, schoolId, input.recordId);
  if (!owned.ok || owned.maxMarks == null) {
    return { success: false, error: "Record not found" };
  }
  if (!recordIsEditable(owned.status)) {
    return { success: false, error: "Record is locked" };
  }

  const fieldErrors = validateBulkMarks(input, owned.maxMarks);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const actorId = await getActorId(supabase);
  const ids: string[] = [];
  for (const e of input.entries) {
    const result = await supersedeMark(supabase, {
      schoolId,
      recordId: input.recordId,
      studentProfileId: e.studentProfileId,
      marksObtained: e.marksObtained ?? null,
      isAbsent: e.isAbsent ?? false,
      remarks: e.remarks?.trim() || null,
      employmentId: input.enteredByEmploymentId,
      actorId,
    });
    if ("error" in result) return { success: false, error: result.error };
    ids.push(result.id);
  }

  await writeRecordingAudit(supabase, {
    schoolId,
    action: "mark.bulk_enter",
    entityType: "assessment_record",
    entityId: input.recordId,
    actorAuthUserId: actorId,
    metadata: { count: ids.length },
  });

  return { success: true, id: input.recordId, markIds: ids };
}
