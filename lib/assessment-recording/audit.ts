import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function writeRecordingAudit(
  supabase: Supabase,
  input: {
    schoolId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    actorAuthUserId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase
    .from("assessment_recording_audit_log")
    .insert({
      school_id: input.schoolId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      actor_auth_user_id: input.actorAuthUserId ?? null,
      old_values: input.oldValues ?? null,
      new_values: input.newValues ?? null,
      metadata: input.metadata ?? {},
    });
  if (error) {
    console.error(
      "assessment_recording_audit_log insert failed:",
      error.message,
    );
  }
}
