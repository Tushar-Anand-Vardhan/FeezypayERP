"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveYearClassesForSchool } from "@/lib/onboarding/school-classes-server";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import {
  trimStaffRows,
  validateStaffRows,
  type StaffFormRow,
} from "@/lib/onboarding/staff";

type Result =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type StaffStepData =
  | {
      success: true;
      blocked: false;
      subjects: Array<{ id: string; name: string }>;
      departments: Array<{ id: string; name: string }>;
      teachers: Array<
        StaffFormRow & {
          id: string;
        }
      >;
    }
  | { success: true; blocked: true }
  | { success: false; error: string };

export async function getStaffStepDataAction(): Promise<StaffStepData> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const classesResult = await getActiveYearClassesForSchool(supabase, schoolId);
  if ("blocked" in classesResult) {
    return { success: true, blocked: true };
  }
  if ("error" in classesResult) {
    return { success: false, error: classesResult.error };
  }

  const [{ data: subjects }, { data: departments }, { data: teachers }] =
    await Promise.all([
      supabase
        .from("subjects")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name"),
      supabase
        .from("departments")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name"),
      supabase
        .from("teachers")
        .select(
          "id, full_name, phone, email, employee_code, designation, is_hod, department_id, teacher_subjects(subject_id, subjects(name))",
        )
        .eq("school_id", schoolId)
        .order("full_name"),
    ]);

  if ((subjects ?? []).length === 0) {
    return { success: true, blocked: true };
  }

  const departmentById = new Map(
    (departments ?? []).map((row) => [row.id, row.name]),
  );

  return {
    success: true,
    blocked: false,
    subjects: subjects ?? [],
    departments: departments ?? [],
    teachers: (teachers ?? []).map((teacher) => {
      const subjectLinks = Array.isArray(teacher.teacher_subjects)
        ? teacher.teacher_subjects
        : [];
      return {
        id: teacher.id,
        fullName: teacher.full_name,
        phone: teacher.phone ?? "",
        email: teacher.email ?? "",
        employeeCode: teacher.employee_code ?? "",
        designation: teacher.designation ?? "",
        departmentName: teacher.department_id
          ? (departmentById.get(teacher.department_id) ?? "")
          : "",
        subjectNames: subjectLinks
          .map((link) => {
            const subject = link.subjects as
              | { name: string }
              | { name: string }[]
              | null;
            if (Array.isArray(subject)) {
              return subject[0]?.name ?? "";
            }
            return subject?.name ?? "";
          })
          .filter(Boolean),
        isHod: teacher.is_hod,
      };
    }),
  };
}

export async function saveStaffAction(formData: FormData): Promise<Result> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const intent = String(formData.get("intent") ?? "save");

  let rows: StaffFormRow[] = [];
  try {
    rows = JSON.parse(String(formData.get("teachers") ?? "[]")) as StaffFormRow[];
  } catch {
    return { success: false, error: "Could not read teacher data." };
  }

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("school_id", schoolId);

  const subjectByName = new Map(
    (subjects ?? []).map((row) => [row.name.toLowerCase(), row.id]),
  );

  const fieldErrors = validateStaffRows(
    rows,
    (subjects ?? []).map((row) => row.name),
    { requireAtLeastOne: intent === "next" },
  );
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const trimmed = trimStaffRows(rows);

  if (intent === "save" && trimmed.length === 0) {
    const { count } = await supabase
      .from("teachers")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId);
    if ((count ?? 0) > 0) {
      return {
        success: false,
        error:
          "Saving an empty staff list would remove all teachers. Add at least one teacher, or keep existing rows.",
      };
    }
  }

  const departmentNames = Array.from(
    new Set(
      trimmed
        .map((row) => row.departmentName)
        .filter(Boolean)
        .map((name) => name),
    ),
  );

  const { data: existingDepartments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("school_id", schoolId);

  const departmentIdByName = new Map(
    (existingDepartments ?? []).map((row) => [row.name.toLowerCase(), row.id]),
  );

  for (const name of departmentNames) {
    if (!departmentIdByName.has(name.toLowerCase())) {
      const { data: inserted, error } = await supabase
        .from("departments")
        .insert({ school_id: schoolId, name })
        .select("id, name")
        .single();
      if (error || !inserted) {
        return { success: false, error: error?.message ?? "Could not create department." };
      }
      departmentIdByName.set(inserted.name.toLowerCase(), inserted.id);
    }
  }

  const { data: existingTeachers } = await supabase
    .from("teachers")
    .select("id")
    .eq("school_id", schoolId);

  const existingIds = (existingTeachers ?? []).map((row) => row.id);
  if (existingIds.length > 0) {
    const { error: linkDeleteError } = await supabase
      .from("teacher_subjects")
      .delete()
      .in("teacher_id", existingIds);
    if (linkDeleteError) {
      return { success: false, error: linkDeleteError.message };
    }

    const { error: teachersDeleteError } = await supabase
      .from("teachers")
      .delete()
      .eq("school_id", schoolId);
    if (teachersDeleteError) {
      return { success: false, error: teachersDeleteError.message };
    }
  }

  const createdEmails: string[] = [];

  for (const row of trimmed) {
    const { data: teacher, error } = await supabase
      .from("teachers")
      .insert({
        school_id: schoolId,
        full_name: row.fullName,
        phone: row.phone || null,
        email: row.email || null,
        employee_code: row.employeeCode || null,
        designation: row.designation || null,
        department_id: row.departmentName
          ? departmentIdByName.get(row.departmentName.toLowerCase()) ?? null
          : null,
        is_hod: row.isHod,
      })
      .select("id, email")
      .single();

    if (error || !teacher) {
      return { success: false, error: error?.message ?? "Could not save teacher." };
    }

    if (row.subjectNames.length > 0) {
      const links = row.subjectNames
        .map((name) => subjectByName.get(name.toLowerCase()))
        .filter((id): id is string => Boolean(id))
        .map((subjectId) => ({
          teacher_id: teacher.id,
          subject_id: subjectId,
        }));

      if (links.length > 0) {
        const { error: linkError } = await supabase
          .from("teacher_subjects")
          .insert(links);
        if (linkError) {
          return { success: false, error: linkError.message };
        }
      }
    }

    if (teacher.email) {
      createdEmails.push(teacher.email);
    }
  }

  // Option 1A: password reset emails only work for addresses that already have
  // an auth user. New teacher emails won't receive a setup link until invited.
  if (createdEmails.length > 0) {
    const authClient = await createClient();
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    for (const email of createdEmails) {
      await authClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/confirm?next=/reset-password&type=recovery`,
      });
    }
  }

  revalidatePath("/onboarding", "layout");
  return {
    success: true,
    message:
      createdEmails.length > 0
        ? "Staff saved. Password setup emails were sent only for emails that already have accounts."
        : "Staff saved successfully.",
  };
}
