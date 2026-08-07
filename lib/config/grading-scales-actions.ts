"use server";

import { revalidatePath } from "next/cache";
import {
  trimGradingScaleInput,
  validateGradingScaleInput,
} from "@/lib/config/grading-scales";
import type { ConfigActionResult, GradingScaleInput } from "@/lib/config/types";
import { recordConfigMutation } from "@/lib/editing/record";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

async function getActorId(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function listGradingScalesAction(options?: {
  includeArchived?: boolean;
}): Promise<
  | {
      success: true;
      scales: Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        archived_at: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("grading_scales")
    .select("id, code, name, description, archived_at")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, scales: data ?? [] };
}

export async function createGradingScaleAction(
  input: GradingScaleInput,
): Promise<ConfigActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimGradingScaleInput(input);
  const fieldErrors = validateGradingScaleInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const { data: scale, error: scaleError } = await supabase
    .from("grading_scales")
    .insert({
      school_id: schoolId,
      code: trimmed.code,
      name: trimmed.name,
      description: trimmed.description || null,
    })
    .select("id")
    .maybeSingle();

  if (scaleError || !scale) {
    return {
      success: false,
      error: scaleError?.message ?? "Could not create grading scale.",
    };
  }

  const { error: versionError } = await supabase
    .from("grading_scale_versions")
    .insert({
      scale_id: scale.id,
      version: 1,
      bands: trimmed.bands,
      published_at: new Date().toISOString(),
      is_immutable: true,
    });

  if (versionError) {
    return { success: false, error: versionError.message };
  }

  revalidatePath("/onboarding", "layout");
  return {
    success: true,
    message: "Grading scale created.",
    id: scale.id,
  };
}

/**
 * Edit draft: if latest version is immutable, create version N+1 and publish it.
 * Never mutates published bands in place.
 */
export async function publishGradingScaleVersionAction(
  scaleId: string,
  bands: GradingScaleInput["bands"],
): Promise<ConfigActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateGradingScaleInput({
    code: "TMP",
    name: "TMP",
    bands,
  });
  const bandErrors = Object.fromEntries(
    Object.entries(fieldErrors).filter(([key]) => key.startsWith("band")),
  );
  if (Object.keys(bandErrors).length > 0) {
    return {
      success: false,
      error: "Please fix band errors.",
      fieldErrors: bandErrors,
    };
  }

  const { supabase, schoolId } = context;
  const { data: scale, error: scaleError } = await supabase
    .from("grading_scales")
    .select("id")
    .eq("id", scaleId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (scaleError || !scale) {
    return { success: false, error: scaleError?.message ?? "Scale not found." };
  }

  const { data: versions, error: versionsError } = await supabase
    .from("grading_scale_versions")
    .select("version")
    .eq("scale_id", scaleId)
    .order("version", { ascending: false })
    .limit(1);

  if (versionsError) {
    return { success: false, error: versionsError.message };
  }

  const nextVersion = (versions?.[0]?.version ?? 0) + 1;
  const { data: inserted, error: insertError } = await supabase
    .from("grading_scale_versions")
    .insert({
      scale_id: scaleId,
      version: nextVersion,
      bands,
      published_at: new Date().toISOString(),
      is_immutable: true,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    return {
      success: false,
      error: insertError?.message ?? "Could not publish scale version.",
    };
  }

  await supabase
    .from("grading_scales")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", scaleId);

  const actorId = await getActorId(supabase);
  await recordConfigMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityType: "grading_scale",
    entityId: scaleId,
    action: "publish_version",
    before: null,
    after: { version: nextVersion, bands, version_id: inserted.id },
    versionLabel: `v${nextVersion}`,
    metadata: { strategy: "V" },
  });

  revalidatePath("/onboarding", "layout");
  return {
    success: true,
    message: `Grading scale version ${nextVersion} published.`,
    id: inserted.id,
  };
}

export async function archiveGradingScaleAction(
  scaleId: string,
): Promise<ConfigActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: before } = await supabase
    .from("grading_scales")
    .select("id, code, name, description, archived_at")
    .eq("id", scaleId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!before) {
    return { success: false, error: "Scale not found." };
  }

  const { error } = await supabase
    .from("grading_scales")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", scaleId)
    .eq("school_id", schoolId)
    .is("archived_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  const actorId = await getActorId(supabase);
  await recordConfigMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityType: "grading_scale",
    entityId: scaleId,
    action: "archive",
    before,
    after: { ...before, archived_at: new Date().toISOString() },
  });

  return { success: true, message: "Grading scale archived.", id: scaleId };
}

export async function restoreGradingScaleAction(
  scaleId: string,
): Promise<ConfigActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: before } = await supabase
    .from("grading_scales")
    .select("id, code, name, description, archived_at")
    .eq("id", scaleId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!before) {
    return { success: false, error: "Scale not found." };
  }

  const { error } = await supabase
    .from("grading_scales")
    .update({
      archived_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scaleId)
    .eq("school_id", schoolId);

  if (error) {
    return {
      success: false,
      error:
        error.code === "23505"
          ? "Cannot restore: an active scale already uses this name or code."
          : error.message,
    };
  }

  const actorId = await getActorId(supabase);
  await recordConfigMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityType: "grading_scale",
    entityId: scaleId,
    action: "restore",
    before,
    after: { ...before, archived_at: null },
  });

  return { success: true, message: "Grading scale restored.", id: scaleId };
}
