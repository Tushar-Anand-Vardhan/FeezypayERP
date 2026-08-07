"use server";

import {
  assertRecordOwned,
  getActorId,
  recordIsEditable,
} from "@/lib/assessment-recording/server-helpers";
import type {
  AttachmentInput,
  RecordingActionResult,
} from "@/lib/assessment-recording/types";
import { validateAttachment } from "@/lib/assessment-recording/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function addAttachmentAction(
  input: AttachmentInput,
): Promise<RecordingActionResult> {
  const fieldErrors = validateAttachment(input);
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
    .from("assessment_record_attachments")
    .insert({
      school_id: schoolId,
      record_id: input.recordId,
      title: input.title.trim(),
      resource_kind: input.resourceKind ?? "link",
      url: input.url?.trim() || null,
      media_id: input.mediaId ?? null,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  return { success: true, id: data?.id };
}

export async function archiveAttachmentAction(
  attachmentId: string,
): Promise<RecordingActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "assessment_recording.edit",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("assessment_record_attachments")
    .update({ archived_at: now, updated_at: now })
    .eq("id", attachmentId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };
  return { success: true, id: attachmentId };
}
