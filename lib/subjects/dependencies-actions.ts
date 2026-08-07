"use server";

import { revalidatePath } from "next/cache";
import {
  assertSubjectOwned,
  getActorId,
} from "@/lib/subjects/server-helpers";
import type {
  SubjectActionResult,
  SubjectDependencyInput,
} from "@/lib/subjects/types";
import { validateSubjectDependencyInput } from "@/lib/subjects/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/subjects");
}

export async function listSubjectDependenciesAction(
  subjectId: string,
  options?: { includeArchived?: boolean },
): Promise<
  | {
      success: true;
      dependencies: Array<{
        id: string;
        depends_on_subject_id: string;
        dependency_type: string;
        notes: string | null;
        archived_at: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertSubjectOwned(supabase, schoolId, subjectId, { allowArchived: true }))) {
    return { success: false, error: "Subject not found." };
  }

  let query = supabase
    .from("subject_dependencies")
    .select("id, depends_on_subject_id, dependency_type, notes, archived_at")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, dependencies: data ?? [] };
}

export async function addSubjectDependencyAction(
  input: SubjectDependencyInput,
): Promise<SubjectActionResult> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateSubjectDependencyInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const subjectId = input.subjectId.trim();
  const dependsOnId = input.dependsOnSubjectId.trim();
  const depType = input.dependencyType ?? "prerequisite";

  if (!(await assertSubjectOwned(supabase, schoolId, subjectId))) {
    return { success: false, error: "Subject not found." };
  }
  if (!(await assertSubjectOwned(supabase, schoolId, dependsOnId))) {
    return { success: false, error: "Depends-on subject not found." };
  }

  const actorId = await getActorId(supabase);

  const { data: archived } = await supabase
    .from("subject_dependencies")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("depends_on_subject_id", dependsOnId)
    .not("archived_at", "is", null)
    .maybeSingle();

  if (archived?.id) {
    const { error } = await supabase
      .from("subject_dependencies")
      .update({
        dependency_type: depType,
        notes: input.notes?.trim() || null,
        archived_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", archived.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidate();
    return {
      success: true,
      message: "Dependency restored.",
      id: archived.id,
    };
  }

  const { data, error } = await supabase
    .from("subject_dependencies")
    .insert({
      subject_id: subjectId,
      depends_on_subject_id: dependsOnId,
      dependency_type: depType,
      notes: input.notes?.trim() || null,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error:
        error?.code === "23505"
          ? "This dependency already exists."
          : (error?.message ?? "Could not add dependency."),
    };
  }

  revalidate();
  return { success: true, message: "Dependency added.", id: data.id };
}

export async function archiveSubjectDependencyAction(
  dependencyId: string,
): Promise<SubjectActionResult> {
  const context = await getAuthenticatedSchoolContext("config.catalog.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: row } = await supabase
    .from("subject_dependencies")
    .select("id, subject_id")
    .eq("id", dependencyId)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Dependency not found." };
  }

  if (!(await assertSubjectOwned(supabase, schoolId, row.subject_id, { allowArchived: true }))) {
    return { success: false, error: "Dependency not found." };
  }

  const { error } = await supabase
    .from("subject_dependencies")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", dependencyId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return { success: true, message: "Dependency removed.", id: dependencyId };
}
