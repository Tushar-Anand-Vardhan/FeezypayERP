"use server";

import { writeRecordingAudit } from "@/lib/assessment-recording/audit";
import {
  assertRecordOwned,
  getActorId,
  recordIsEditable,
} from "@/lib/assessment-recording/server-helpers";
import type {
  OutcomeCoverageInput,
  RecordingActionResult,
  TopicCoverageInput,
} from "@/lib/assessment-recording/types";
import {
  validateOutcomeCoverage,
  validateTopicCoverage,
} from "@/lib/assessment-recording/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function addTopicCoverageAction(
  input: TopicCoverageInput,
): Promise<RecordingActionResult> {
  const fieldErrors = validateTopicCoverage(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertRecordOwned(supabase, schoolId, input.recordId);
  if (!owned.ok) return { success: false, error: "Record not found" };
  if (!recordIsEditable(owned.status)) {
    return { success: false, error: "Record is locked" };
  }

  const actorId = await getActorId(supabase);
  const { data, error } = await supabase
    .from("assessment_record_topics")
    .insert({
      school_id: schoolId,
      record_id: input.recordId,
      node_type: input.nodeType,
      node_id: input.nodeId,
      curriculum_version_id: input.curriculumVersionId ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };

  await writeRecordingAudit(supabase, {
    schoolId,
    action: "coverage.topic.add",
    entityType: "assessment_record_topic",
    entityId: data?.id,
    actorAuthUserId: actorId,
  });
  return { success: true, id: data?.id };
}

export async function addOutcomeCoverageAction(
  input: OutcomeCoverageInput,
): Promise<RecordingActionResult> {
  const fieldErrors = validateOutcomeCoverage(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertRecordOwned(supabase, schoolId, input.recordId);
  if (!owned.ok) return { success: false, error: "Record not found" };
  if (!recordIsEditable(owned.status)) {
    return { success: false, error: "Record is locked" };
  }

  const { data, error } = await supabase
    .from("assessment_record_outcomes")
    .insert({
      school_id: schoolId,
      record_id: input.recordId,
      learning_outcome_id: input.learningOutcomeId,
    })
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  return { success: true, id: data?.id };
}

export async function removeTopicCoverageAction(
  linkId: string,
): Promise<RecordingActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("assessment_record_topics")
    .update({ archived_at: now })
    .eq("id", linkId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };
  return { success: true, id: linkId };
}

export async function removeOutcomeCoverageAction(
  linkId: string,
): Promise<RecordingActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("assessment_record_outcomes")
    .update({ archived_at: now })
    .eq("id", linkId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };
  return { success: true, id: linkId };
}
