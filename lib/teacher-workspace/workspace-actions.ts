"use server";

import {
  parseAsOfDate,
} from "@/lib/teacher-workspace/catalog";
import {
  listActiveEmployments,
  resolveEmploymentForAuthUser,
} from "@/lib/teacher-workspace/server-helpers";
import type {
  TeacherWorkspaceAggregate,
  TeacherWorkspaceEmployment,
} from "@/lib/teacher-workspace/types";
import { buildTeacherWorkspace } from "@/lib/teacher-workspace/workspace";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import { createClient } from "@/lib/supabase/server";

export async function listTeacherWorkspaceEmploymentsAction(): Promise<
  | { success: true; employments: TeacherWorkspaceEmployment[] }
  | { success: false; error: string }
> {
  const ctx = await getAuthenticatedSchoolContext("workforce.workspace.read");
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  try {
    const employments = await listActiveEmployments(
      ctx.supabase,
      ctx.schoolId,
    );
    return { success: true, employments };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to list teacher employments.",
    };
  }
}

export async function resolveTeacherWorkspaceContextAction(): Promise<
  | {
      success: true;
      linkedEmployment: TeacherWorkspaceEmployment | null;
      employments: TeacherWorkspaceEmployment[];
    }
  | { success: false; error: string }
> {
  const ctx = await getAuthenticatedSchoolContext("workforce.workspace.read");
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string"
      ? claimsData.claims.sub
      : null;

  try {
    const employments = await listActiveEmployments(
      ctx.supabase,
      ctx.schoolId,
    );
    const linkedEmployment = userId
      ? await resolveEmploymentForAuthUser(
          ctx.supabase,
          ctx.schoolId,
          userId,
        )
      : null;
    return { success: true, linkedEmployment, employments };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to resolve teacher workspace context.",
    };
  }
}

export async function getTeacherWorkspaceAction(input?: {
  employmentId?: string;
  asOfDate?: string;
}): Promise<
  | { success: true; workspace: TeacherWorkspaceAggregate }
  | { success: false; error: string }
> {
  const ctx = await getAuthenticatedSchoolContext("workforce.workspace.read");
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string"
      ? claimsData.claims.sub
      : null;

  try {
    let employmentId = input?.employmentId?.trim() || null;

    if (!employmentId && userId) {
      const linked = await resolveEmploymentForAuthUser(
        ctx.supabase,
        ctx.schoolId,
        userId,
      );
      employmentId = linked?.employmentId ?? null;
    }

    if (!employmentId) {
      const employments = await listActiveEmployments(
        ctx.supabase,
        ctx.schoolId,
      );
      employmentId = employments[0]?.employmentId ?? null;
    }

    if (!employmentId) {
      return {
        success: false,
        error: "No active teacher employment found for this school.",
      };
    }

    const asOf = parseAsOfDate(input?.asOfDate);
    const workspace = await buildTeacherWorkspace(
      ctx.supabase,
      ctx.schoolId,
      employmentId,
      asOf,
    );

    if (!workspace) {
      return { success: false, error: "Employment not found in this school." };
    }

    return { success: true, workspace };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to build teacher workspace.",
    };
  }
}
