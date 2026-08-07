"use server";

import {
  assertCurriculumOwned,
  getCurrentVersion,
  loadCurriculumTree,
} from "@/lib/curriculum/server-helpers";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function getCurriculumTreeAction(
  curriculumId: string,
): Promise<
  | { success: true; tree: NonNullable<Awaited<ReturnType<typeof loadCurriculumTree>>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("curriculum.pack.read");
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const tree = await loadCurriculumTree(supabase, schoolId, curriculumId);
  if (!tree) return { success: false, error: "Curriculum not found" };
  return { success: true, tree };
}

export async function listCurriculumVersionsAction(
  curriculumId: string,
): Promise<
  | { success: true; versions: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("curriculum.pack.read");
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertCurriculumOwned(supabase, schoolId, curriculumId, {
    allowArchived: true,
  });
  if (!owned.ok) return { success: false, error: "Curriculum not found" };

  const { data, error } = await supabase
    .from("curriculum_versions")
    .select(
      "id, version, change_summary, published_at, is_immutable, is_current, created_at",
    )
    .eq("curriculum_id", curriculumId)
    .order("version", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, versions: data ?? [] };
}

export async function getCurrentCurriculumVersionAction(
  curriculumId: string,
): Promise<
  | { success: true; version: Record<string, unknown> | null }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("curriculum.pack.read");
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertCurriculumOwned(supabase, schoolId, curriculumId);
  if (!owned.ok) return { success: false, error: "Curriculum not found" };

  const version = await getCurrentVersion(supabase, curriculumId);
  return { success: true, version: version as Record<string, unknown> | null };
}
