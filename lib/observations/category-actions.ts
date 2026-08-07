"use server";

import { revalidatePath } from "next/cache";
import {
  getActorId,
  writeObservationAudit,
} from "@/lib/observations/server-helpers";
import {
  SYSTEM_OBSERVATION_CATEGORIES,
  type ObservationActionResult,
  type UpsertCategoryInput,
} from "@/lib/observations/types";
import { validateUpsertCategoryInput } from "@/lib/observations/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/observations");
  revalidatePath("/dashboard/teacher");
}

export async function ensureSystemObservationCategoriesAction(): Promise<
  ObservationActionResult & { seeded?: number }
> {
  const context = await getAuthenticatedSchoolContext(
    "student_observation.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  const { data: existing } = await supabase
    .from("student_observation_categories")
    .select("code")
    .eq("school_id", schoolId)
    .is("archived_at", null);

  const have = new Set(
    (existing ?? []).map((r) => String(r.code).toLowerCase()),
  );
  const toInsert = SYSTEM_OBSERVATION_CATEGORIES.filter(
    (c) => !have.has(c.code.toLowerCase()),
  );

  if (toInsert.length === 0) {
    return {
      success: true,
      message: "System observation categories already present.",
      seeded: 0,
    };
  }

  const { error } = await supabase.from("student_observation_categories").insert(
    toInsert.map((c) => ({
      school_id: schoolId,
      code: c.code,
      name: c.name,
      is_system: true,
      display_order: c.displayOrder,
      created_by: actorId,
    })),
  );

  if (error) {
    return { success: false, error: error.message };
  }

  await writeObservationAudit(supabase, {
    schoolId,
    action: "categories.system_seeded",
    actorId,
    newValues: { codes: toInsert.map((c) => c.code) },
  });

  revalidate();
  return {
    success: true,
    message: `Seeded ${toInsert.length} system categories.`,
    seeded: toInsert.length,
  };
}

export async function upsertCustomObservationCategoryAction(
  input: UpsertCategoryInput,
): Promise<ObservationActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "student_observation.configure",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateUpsertCategoryInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const code = input.code.trim().toLowerCase();
  const now = new Date().toISOString();

  if (input.id) {
    const { data: row } = await supabase
      .from("student_observation_categories")
      .select("id, is_system")
      .eq("id", input.id)
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .maybeSingle();
    if (!row) {
      return { success: false, error: "Category not found." };
    }
    if (row.is_system) {
      return {
        success: false,
        error: "System categories cannot be edited — archive custom only.",
      };
    }

    const { data, error } = await supabase
      .from("student_observation_categories")
      .update({
        code,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        display_order: input.displayOrder ?? 100,
        updated_at: now,
      })
      .eq("id", input.id)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Could not update category.",
      };
    }

    await writeObservationAudit(supabase, {
      schoolId,
      action: "category.updated",
      actorId,
      categoryId: data.id,
      newValues: { code, name: input.name.trim() },
    });

    revalidate();
    return { success: true, message: "Category updated.", id: data.id };
  }

  const { data, error } = await supabase
    .from("student_observation_categories")
    .insert({
      school_id: schoolId,
      code,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      is_system: false,
      display_order: input.displayOrder ?? 100,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create category.",
    };
  }

  await writeObservationAudit(supabase, {
    schoolId,
    action: "category.created",
    actorId,
    categoryId: data.id,
    newValues: { code },
  });

  revalidate();
  return { success: true, message: "Custom category created.", id: data.id };
}

export async function archiveObservationCategoryAction(
  categoryId: string,
): Promise<ObservationActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "student_observation.configure",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const { data: row } = await supabase
    .from("student_observation_categories")
    .select("id, is_system, code")
    .eq("id", categoryId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Category not found." };
  }
  if (row.is_system) {
    return { success: false, error: "System categories cannot be archived." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("student_observation_categories")
    .update({ archived_at: now, updated_at: now })
    .eq("id", categoryId);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeObservationAudit(supabase, {
    schoolId,
    action: "category.archived",
    actorId,
    categoryId,
    oldValues: { code: row.code },
  });

  revalidate();
  return { success: true, message: "Category archived.", id: categoryId };
}

export async function listObservationCategoriesAction(): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "student_observation.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  // Ensure system seeds exist for new schools
  await ensureSystemObservationCategoriesAction();

  const { data, error } = await supabase
    .from("student_observation_categories")
    .select(
      "id, code, name, description, is_system, display_order, created_at",
    )
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .order("display_order", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}
