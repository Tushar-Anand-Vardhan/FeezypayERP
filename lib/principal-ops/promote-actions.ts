"use server";

import { revalidatePath } from "next/cache";
import { defaultRulesForKind } from "@/lib/policies/defaults";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import type { PrincipalOpsResult } from "@/lib/principal-ops/teachers-actions";

function revalidate() {
  revalidatePath("/dashboard/principal");
  revalidatePath("/dashboard/principal/promote");
  revalidatePath("/dashboard/principal/students");
  revalidatePath("/dashboard/teacher");
}

export type PromotionDecision = "promoted" | "repeated" | "graduated";

export type PromoteDecisionInput = {
  studentAcademicYearId: string;
  decision: PromotionDecision;
  /** Required for promoted/repeated */
  targetClassId?: string | null;
  targetSectionId?: string | null;
};

/** Load placements + promotion_rules snapshot for an academic year. */
export async function listPromotionCandidatesAction(input: {
  sourceAcademicYearId: string;
  targetAcademicYearId?: string;
}): Promise<
  | {
      success: true;
      rules: Record<string, unknown>;
      candidates: Array<{
        studentAcademicYearId: string;
        admissionId: string;
        studentProfileId: string;
        fullName: string;
        classId: string;
        className: string;
        sectionId: string;
        sectionName: string;
        rollNumber: string | null;
        suggestedNextClassId: string | null;
        suggestedNextSectionId: string | null;
      }>;
      targetClasses: Array<{
        id: string;
        name: string;
        displayOrder: number;
        sections: Array<{ id: string; name: string }>;
      }>;
      years: Array<{ id: string; label: string; isActive: boolean }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "enrollment.placement.edit",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const academicYearId = input.sourceAcademicYearId;
  const targetYearId =
    input.targetAcademicYearId?.trim() || academicYearId;

  const { data: year } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", academicYearId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  if (!year) {
    return { success: false, error: "Academic year not found." };
  }

  const { data: targetYear } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", targetYearId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  if (!targetYear) {
    return { success: false, error: "Target academic year not found." };
  }

  const { data: years } = await supabase
    .from("academic_years")
    .select("id, label, is_active")
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .order("label", { ascending: false });

  let rules = defaultRulesForKind("promotion_rules");
  const { data: policy } = await supabase
    .from("school_policies")
    .select("id")
    .eq("school_id", schoolId)
    .eq("policy_kind", "promotion_rules")
    .eq("status", "published")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (policy?.id) {
    const { data: version } = await supabase
      .from("school_policy_versions")
      .select("rules")
      .eq("policy_id", policy.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (version?.rules && typeof version.rules === "object") {
      rules = version.rules as Record<string, unknown>;
    }
  }

  async function loadClasses(yearId: string) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, display_order, academic_year_id, sections(id, name)")
      .eq("academic_year_id", yearId)
      .is("archived_at", null)
      .order("display_order");
    return (classes ?? []).map((c) => {
      const secs = (
        Array.isArray(c.sections) ? c.sections : c.sections ? [c.sections] : []
      ) as Array<{ id: string; name: string }>;
      return {
        id: c.id,
        name: c.name,
        displayOrder: c.display_order as number,
        sections: secs.map((s) => ({ id: s.id, name: s.name })),
      };
    });
  }

  const sourceClasses = await loadClasses(academicYearId);
  const targetClasses = await loadClasses(targetYearId);

  const sourceSorted = [...sourceClasses].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
  const targetSorted = [...targetClasses].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  // Map source class → next target class by display order index + 1, else same name
  const nextTargetBySourceClass = new Map<string, string | null>();
  for (let i = 0; i < sourceSorted.length; i += 1) {
    const src = sourceSorted[i];
    const byOrder = targetSorted[i + 1]?.id ?? null;
    const byName =
      targetSorted.find(
        (t) => t.name.toLowerCase() === src.name.toLowerCase(),
      )?.id ?? null;
    // For promote suggestion: prefer next order in target year
    nextTargetBySourceClass.set(src.id, byOrder ?? byName);
  }

  const { data: admissions } = await supabase
    .from("student_admissions")
    .select("id, student_profile_id, student_profiles(persons(full_name))")
    .eq("school_id", schoolId)
    .eq("status", "active");

  const admissionMeta = new Map<
    string,
    { studentProfileId: string; fullName: string }
  >();
  for (const a of admissions ?? []) {
    const profile = a.student_profiles as
      | {
          persons?:
            | { full_name?: string }
            | { full_name?: string }[]
            | null;
        }
      | {
          persons?:
            | { full_name?: string }
            | { full_name?: string }[]
            | null;
        }[]
      | null;
    const p = Array.isArray(profile) ? profile[0] : profile;
    const person = Array.isArray(p?.persons) ? p?.persons[0] : p?.persons;
    admissionMeta.set(a.id, {
      studentProfileId: a.student_profile_id,
      fullName: person?.full_name ?? "Student",
    });
  }

  const admissionIds = [...admissionMeta.keys()];
  let placements: Array<{
    id: string;
    roll_number: string | null;
    class_id: string;
    section_id: string;
    admission_id: string;
    classes: unknown;
    sections: unknown;
  }> = [];

  if (admissionIds.length > 0) {
    const { data } = await supabase
      .from("student_academic_years")
      .select(
        "id, roll_number, class_id, section_id, admission_id, classes(name), sections(name)",
      )
      .eq("academic_year_id", academicYearId)
      .eq("status", "active")
      .is("left_on", null)
      .in("admission_id", admissionIds);
    placements = (data ?? []) as typeof placements;
  }

  const candidates = placements.map((p) => {
    const meta = admissionMeta.get(p.admission_id);
    const cls = p.classes as
      | { name?: string }
      | { name?: string }[]
      | null;
    const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
    const sec = p.sections as
      | { name?: string }
      | { name?: string }[]
      | null;
    const sectionName = Array.isArray(sec) ? sec[0]?.name : sec?.name;

    const suggestedNextClassId =
      nextTargetBySourceClass.get(p.class_id) ?? null;
    const nextClass = suggestedNextClassId
      ? targetClasses.find((c) => c.id === suggestedNextClassId)
      : null;
    const suggestedNextSectionId =
      nextClass?.sections.find((s) => s.name === sectionName)?.id ??
      nextClass?.sections[0]?.id ??
      null;

    return {
      studentAcademicYearId: p.id,
      admissionId: p.admission_id,
      studentProfileId: meta?.studentProfileId ?? "",
      fullName: meta?.fullName ?? "Student",
      classId: p.class_id,
      className: className ?? p.class_id,
      sectionId: p.section_id,
      sectionName: sectionName ?? p.section_id,
      rollNumber: p.roll_number,
      suggestedNextClassId,
      suggestedNextSectionId,
    };
  });

  return {
    success: true,
    rules,
    candidates,
    targetClasses,
    years: (years ?? []).map((y) => ({
      id: y.id,
      label: y.label,
      isActive: Boolean(y.is_active),
    })),
  };
}

/**
 * Apply EOY decisions within the same academic structure.
 * - promoted: complete current placement; open new placement in next class/section (same year or target year)
 * - repeated: complete current; open new placement in same class (target year preferred)
 * - graduated: complete current; set admission alumni
 *
 * Respects promotion_rules as a documented gate: if min_overall_percent is set we
 * still allow principal override (principal decision is authoritative for Wave 2).
 */
export async function applyPromotionBatchAction(input: {
  sourceAcademicYearId: string;
  targetAcademicYearId: string;
  decisions: PromoteDecisionInput[];
}): Promise<PrincipalOpsResult> {
  const context = await getAuthenticatedSchoolContext(
    "enrollment.placement.edit",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  if (!input.decisions.length) {
    return { success: false, error: "No promotion decisions provided." };
  }

  const { supabase, schoolId } = context;
  const today = new Date().toISOString().slice(0, 10);

  for (const yearId of [
    input.sourceAcademicYearId,
    input.targetAcademicYearId,
  ]) {
    const { data: y } = await supabase
      .from("academic_years")
      .select("id")
      .eq("id", yearId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!y) {
      return { success: false, error: "Academic year not found." };
    }
  }

  let applied = 0;
  for (const d of input.decisions) {
    const { data: placement } = await supabase
      .from("student_academic_years")
      .select("id, admission_id, class_id, section_id, academic_year_id, status")
      .eq("id", d.studentAcademicYearId)
      .eq("academic_year_id", input.sourceAcademicYearId)
      .maybeSingle();

    if (!placement || placement.status !== "active") {
      return {
        success: false,
        error: `Placement ${d.studentAcademicYearId} not found or not active.`,
      };
    }

    const { data: admission } = await supabase
      .from("student_admissions")
      .select("id")
      .eq("id", placement.admission_id)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!admission) {
      return { success: false, error: "Admission not found for placement." };
    }

    const { error: closeError } = await supabase
      .from("student_academic_years")
      .update({
        status: "completed",
        left_on: today,
        promotion_status: d.decision,
      })
      .eq("id", placement.id);

    if (closeError) {
      return { success: false, error: closeError.message };
    }

    if (d.decision === "graduated") {
      const { error: admError } = await supabase
        .from("student_admissions")
        .update({
          status: "alumni",
          exited_on: today,
          updated_at: new Date().toISOString(),
        })
        .eq("id", placement.admission_id)
        .eq("school_id", schoolId);
      if (admError) {
        return { success: false, error: admError.message };
      }
      const { syncStudentMembership } = await import("@/lib/membership/sync");
      await syncStudentMembership(supabase, placement.admission_id);
      applied += 1;
      continue;
    }

    const targetClassId =
      d.targetClassId ??
      (d.decision === "repeated" ? placement.class_id : null);
    const targetSectionId =
      d.targetSectionId ??
      (d.decision === "repeated" ? placement.section_id : null);

    if (!targetClassId || !targetSectionId) {
      return {
        success: false,
        error: `Target class/section required for ${d.decision} (${placement.id}).`,
      };
    }

    const { data: targetClass } = await supabase
      .from("classes")
      .select("id, academic_year_id")
      .eq("id", targetClassId)
      .eq("academic_year_id", input.targetAcademicYearId)
      .maybeSingle();
    if (!targetClass) {
      return {
        success: false,
        error: "Target class must belong to the target academic year.",
      };
    }

    const { data: targetSection } = await supabase
      .from("sections")
      .select("id")
      .eq("id", targetSectionId)
      .eq("class_id", targetClassId)
      .maybeSingle();
    if (!targetSection) {
      return { success: false, error: "Target section not found for class." };
    }

    // Avoid duplicate active placement
    const { data: existing } = await supabase
      .from("student_academic_years")
      .select("id")
      .eq("admission_id", placement.admission_id)
      .eq("academic_year_id", input.targetAcademicYearId)
      .eq("status", "active")
      .is("left_on", null)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: `Student already has an active placement in the target year (${existing.id}).`,
      };
    }

    const { error: insertError } = await supabase
      .from("student_academic_years")
      .insert({
        admission_id: placement.admission_id,
        academic_year_id: input.targetAcademicYearId,
        class_id: targetClassId,
        section_id: targetSectionId,
        status: "active",
        enrollment_type: d.decision === "repeated" ? "repeated" : "promoted",
        enrolled_on: today,
      });

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    applied += 1;
  }

  revalidate();
  return {
    success: true,
    message: `Applied ${applied} promotion decision(s).`,
  };
}
