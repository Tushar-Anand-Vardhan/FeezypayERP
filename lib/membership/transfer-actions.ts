"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz/require";
import { syncStudentMembership } from "@/lib/membership/sync";

type Result =
  | { success: true; fromMembershipId?: string; toMembershipId?: string }
  | { success: false; error: string };

/**
 * End student membership at school A and sync membership at school B
 * after E06 has created/updated the destination admission.
 */
export async function transferStudentMembershipAction(input: {
  fromAdmissionId: string;
  toAdmissionId: string;
  effectiveDate?: string;
}): Promise<Result> {
  const ctx = await requirePermission("enrollment.admission.edit");
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  const today = input.effectiveDate ?? new Date().toISOString().slice(0, 10);

  const { data: fromAdmission, error: fromErr } = await ctx.supabase
    .from("student_admissions")
    .select("id, school_id, status")
    .eq("id", input.fromAdmissionId)
    .eq("school_id", ctx.schoolId)
    .maybeSingle();

  if (fromErr || !fromAdmission) {
    return {
      success: false,
      error: fromErr?.message ?? "Source admission not found at this school.",
    };
  }

  if (fromAdmission.status !== "transferred") {
    const { error: updErr } = await ctx.supabase
      .from("student_admissions")
      .update({
        status: "transferred",
        exited_on: today,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fromAdmission.id);

    if (updErr) {
      return { success: false, error: updErr.message };
    }
  }

  const fromSync = await syncStudentMembership(
    ctx.supabase,
    input.fromAdmissionId,
  );
  if (!fromSync.ok) {
    return { success: false, error: fromSync.error };
  }

  const { data: toAdmission, error: toErr } = await ctx.supabase
    .from("student_admissions")
    .select("id, school_id, status")
    .eq("id", input.toAdmissionId)
    .maybeSingle();

  if (toErr || !toAdmission) {
    return {
      success: false,
      error: toErr?.message ?? "Destination admission not found.",
    };
  }

  if (toAdmission.status !== "active") {
    const { error: actErr } = await ctx.supabase
      .from("student_admissions")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", toAdmission.id);
    if (actErr) {
      return { success: false, error: actErr.message };
    }
  }

  const toSync = await syncStudentMembership(ctx.supabase, input.toAdmissionId);
  if (!toSync.ok) {
    return { success: false, error: toSync.error };
  }

  const { error: endErr } = await ctx.supabase
    .from("school_memberships")
    .update({
      status: "transferred",
      effective_to: today,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fromSync.id);

  if (endErr) {
    return { success: false, error: endErr.message };
  }

  revalidatePath("/dashboard");
  return {
    success: true,
    fromMembershipId: fromSync.id,
    toMembershipId: toSync.id,
  };
}
