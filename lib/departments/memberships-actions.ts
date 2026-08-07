"use server";

import { revalidatePath } from "next/cache";
import {
  appendDepartmentHistory,
  assertDepartmentOwned,
  assertEmploymentOwned,
  getActorId,
  syncEmploymentDepartmentFlags,
} from "@/lib/departments/server-helpers";
import type {
  DepartmentActionResult,
  MembershipInput,
} from "@/lib/departments/types";
import {
  trimMembershipInput,
  validateMembershipInput,
} from "@/lib/departments/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listDepartmentMembershipsAction(
  departmentId: string,
  options?: { includeEnded?: boolean },
): Promise<
  | {
      success: true;
      memberships: Array<{
        id: string;
        employment_id: string;
        role: string;
        joined_on: string;
        left_on: string | null;
        notes: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertDepartmentOwned(supabase, schoolId, departmentId))) {
    return { success: false, error: "Department not found." };
  }

  let query = supabase
    .from("department_memberships")
    .select("id, employment_id, role, joined_on, left_on, notes")
    .eq("department_id", departmentId)
    .order("joined_on", { ascending: false });

  if (!options?.includeEnded) {
    query = query.is("left_on", null);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, memberships: data ?? [] };
}

export async function addDepartmentMembershipAction(
  input: MembershipInput,
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const trimmed = trimMembershipInput(input);
  const fieldErrors = validateMembershipInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (
    !(await assertDepartmentOwned(supabase, schoolId, trimmed.departmentId))
  ) {
    return { success: false, error: "Department not found." };
  }
  if (
    !(await assertEmploymentOwned(supabase, schoolId, trimmed.employmentId))
  ) {
    return { success: false, error: "Active employment not found." };
  }

  const actorId = await getActorId(supabase);

  if (trimmed.role === "head") {
    const { data: existingHead } = await supabase
      .from("department_memberships")
      .select("id, employment_id")
      .eq("department_id", trimmed.departmentId)
      .eq("role", "head")
      .is("left_on", null)
      .maybeSingle();

    if (existingHead && existingHead.employment_id !== trimmed.employmentId) {
      const today = new Date().toISOString().slice(0, 10);
      await supabase
        .from("department_memberships")
        .update({ left_on: today, updated_at: new Date().toISOString() })
        .eq("id", existingHead.id);

      await syncEmploymentDepartmentFlags(
        supabase,
        schoolId,
        existingHead.employment_id,
      );

      await appendDepartmentHistory(supabase, {
        departmentId: trimmed.departmentId,
        action: "membership.ended",
        summary: "Previous head ended for succession",
        changes: { membershipId: existingHead.id, role: "head" },
        actorId,
      });
    }
  }

  const { data: activeSame } = await supabase
    .from("department_memberships")
    .select("id, role")
    .eq("department_id", trimmed.departmentId)
    .eq("employment_id", trimmed.employmentId)
    .is("left_on", null)
    .maybeSingle();

  if (activeSame) {
    const { error } = await supabase
      .from("department_memberships")
      .update({
        role: trimmed.role,
        notes: trimmed.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeSame.id);

    if (error) {
      return { success: false, error: error.message };
    }

    await syncEmploymentDepartmentFlags(
      supabase,
      schoolId,
      trimmed.employmentId,
    );

    await appendDepartmentHistory(supabase, {
      departmentId: trimmed.departmentId,
      action: "membership.updated",
      summary: `Membership role set to ${trimmed.role}`,
      changes: {
        membershipId: activeSame.id,
        employmentId: trimmed.employmentId,
        role: trimmed.role,
      },
      actorId,
    });

    revalidatePath("/dashboard");
    return {
      success: true,
      message: "Membership updated.",
      id: activeSame.id,
    };
  }

  const { data, error } = await supabase
    .from("department_memberships")
    .insert({
      department_id: trimmed.departmentId,
      employment_id: trimmed.employmentId,
      role: trimmed.role,
      joined_on: trimmed.joinedOn || new Date().toISOString().slice(0, 10),
      notes: trimmed.notes ?? null,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not add membership.",
    };
  }

  await syncEmploymentDepartmentFlags(
    supabase,
    schoolId,
    trimmed.employmentId,
  );

  await appendDepartmentHistory(supabase, {
    departmentId: trimmed.departmentId,
    action: "membership.added",
    summary: `Added ${trimmed.role}`,
    changes: {
      membershipId: data.id,
      employmentId: trimmed.employmentId,
      role: trimmed.role,
    },
    actorId,
  });

  revalidatePath("/dashboard");
  return { success: true, message: "Membership added.", id: data.id };
}

export async function endDepartmentMembershipAction(
  membershipId: string,
  leftOn?: string,
): Promise<DepartmentActionResult> {
  const context = await getAuthenticatedSchoolContext("workforce.department.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: membership } = await supabase
    .from("department_memberships")
    .select("id, department_id, employment_id, role, left_on")
    .eq("id", membershipId)
    .maybeSingle();

  if (!membership) {
    return { success: false, error: "Membership not found." };
  }

  if (
    !(await assertDepartmentOwned(
      supabase,
      schoolId,
      membership.department_id,
    ))
  ) {
    return { success: false, error: "Department not found." };
  }

  if (membership.left_on) {
    return { success: false, error: "Membership already ended." };
  }

  const actorId = await getActorId(supabase);
  const endDate = leftOn || new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("department_memberships")
    .update({
      left_on: endDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", membershipId);

  if (error) {
    return { success: false, error: error.message };
  }

  await syncEmploymentDepartmentFlags(
    supabase,
    schoolId,
    membership.employment_id,
  );

  await appendDepartmentHistory(supabase, {
    departmentId: membership.department_id,
    action: "membership.ended",
    summary: `Ended ${membership.role} membership`,
    changes: {
      membershipId,
      employmentId: membership.employment_id,
      role: membership.role,
      leftOn: endDate,
    },
    actorId,
  });

  revalidatePath("/dashboard");
  return { success: true, message: "Membership ended.", id: membershipId };
}
