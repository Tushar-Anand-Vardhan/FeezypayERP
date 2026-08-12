"use server";

import { revalidatePath } from "next/cache";
import { syncStudentMembership } from "@/lib/membership/sync";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import type { PrincipalOpsResult } from "@/lib/principal-ops/teachers-actions";

function revalidate() {
  revalidatePath("/dashboard/principal");
  revalidatePath("/dashboard/principal/students");
  revalidatePath("/dashboard/principal/promote");
  revalidatePath("/dashboard/teacher");
  revalidatePath("/onboarding", "layout");
}

export async function listPrincipalStudentsAction(academicYearId: string): Promise<
  | {
      success: true;
      students: Array<{
        admissionId: string;
        studentProfileId: string;
        fullName: string;
        admissionNumber: string | null;
        status: string;
        studentAcademicYearId: string | null;
        className: string | null;
        sectionName: string | null;
        rollNumber: string | null;
      }>;
      years: Array<{ id: string; label: string; isActive: boolean }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "enrollment.admission.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  const { data: years } = await supabase
    .from("academic_years")
    .select("id, label, is_active")
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .order("label", { ascending: false });

  const { data: admissions, error } = await supabase
    .from("student_admissions")
    .select(
      "id, admission_number, status, student_profile_id, student_profiles(persons(full_name))",
    )
    .eq("school_id", schoolId)
    .order("admission_number");

  if (error) {
    return { success: false, error: error.message };
  }

  const admissionIds = (admissions ?? []).map((a) => a.id);
  const placementByAdmission = new Map<
    string,
    {
      id: string;
      roll_number: string | null;
      className: string | null;
      sectionName: string | null;
    }
  >();

  if (admissionIds.length > 0) {
    const { data: placements } = await supabase
      .from("student_academic_years")
      .select(
        "id, admission_id, roll_number, status, left_on, classes(name), sections(name)",
      )
      .eq("academic_year_id", academicYearId)
      .in("admission_id", admissionIds)
      .eq("status", "active")
      .is("left_on", null);

    for (const p of placements ?? []) {
      const cls = p.classes as
        | { name?: string }
        | { name?: string }[]
        | null;
      const sec = p.sections as
        | { name?: string }
        | { name?: string }[]
        | null;
      placementByAdmission.set(p.admission_id, {
        id: p.id,
        roll_number: p.roll_number,
        className: Array.isArray(cls) ? cls[0]?.name ?? null : cls?.name ?? null,
        sectionName: Array.isArray(sec)
          ? sec[0]?.name ?? null
          : sec?.name ?? null,
      });
    }
  }

  const students = (admissions ?? []).map((a) => {
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
    const placement = placementByAdmission.get(a.id);
    return {
      admissionId: a.id,
      studentProfileId: a.student_profile_id,
      fullName: person?.full_name ?? "Student",
      admissionNumber: a.admission_number,
      status: a.status,
      studentAcademicYearId: placement?.id ?? null,
      className: placement?.className ?? null,
      sectionName: placement?.sectionName ?? null,
      rollNumber: placement?.roll_number ?? null,
    };
  });

  return {
    success: true,
    students,
    years: (years ?? []).map((y) => ({
      id: y.id,
      label: y.label,
      isActive: Boolean(y.is_active),
    })),
  };
}

/**
 * Expel / withdraw: mark admission withdrawn, close active placements,
 * sync membership. Maps product "expel" → admission status `withdrawn`.
 */
export async function withdrawStudentAction(input: {
  admissionId: string;
  reason?: string;
}): Promise<PrincipalOpsResult> {
  const context = await getAuthenticatedSchoolContext(
    "enrollment.admission.edit",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const today = new Date().toISOString().slice(0, 10);

  const { data: admission } = await supabase
    .from("student_admissions")
    .select("id, status")
    .eq("id", input.admissionId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!admission) {
    return { success: false, error: "Admission not found." };
  }
  if (admission.status !== "active") {
    return {
      success: false,
      error: `Admission is already ${admission.status}.`,
    };
  }

  const { error: sayError } = await supabase
    .from("student_academic_years")
    .update({
      status: "withdrawn",
      left_on: today,
    })
    .eq("admission_id", input.admissionId)
    .eq("status", "active")
    .is("left_on", null);

  if (sayError) {
    return { success: false, error: sayError.message };
  }

  const { error: admError } = await supabase
    .from("student_admissions")
    .update({
      status: "withdrawn",
      exited_on: today,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.admissionId)
    .eq("school_id", schoolId);

  if (admError) {
    return { success: false, error: admError.message };
  }

  await syncStudentMembership(supabase, input.admissionId);
  revalidate();
  return {
    success: true,
    message: "Student withdrawn from school.",
    id: input.admissionId,
  };
}
