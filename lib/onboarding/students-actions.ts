"use server";

import { revalidatePath } from "next/cache";
import { getActiveYearClassesForSchool } from "@/lib/onboarding/school-classes-server";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import {
  trimStudentRows,
  validateStudentRows,
  type StudentFormRow,
} from "@/lib/onboarding/students";

type Result =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type StudentsStepData =
  | {
      success: true;
      blocked: false;
      classSections: Array<{
        classId: string;
        className: string;
        sectionId: string;
        sectionName: string;
      }>;
      students: StudentFormRow[];
    }
  | { success: true; blocked: true }
  | { success: false; error: string };

export async function getStudentsStepDataAction(): Promise<StudentsStepData> {
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

  const classIds = classesResult.classes.map((row) => row.id);
  const { data: sections } = await supabase
    .from("sections")
    .select("id, name, class_id")
    .in("class_id", classIds)
    .order("display_order");

  if (!sections || sections.length === 0) {
    return { success: true, blocked: true };
  }

  const classNameById = new Map(
    classesResult.classes.map((row) => [row.id, row.name]),
  );

  const classSections = sections.map((section) => ({
    classId: section.class_id,
    className: classNameById.get(section.class_id) ?? "",
    sectionId: section.id,
    sectionName: section.name,
  }));

  const { data: students } = await supabase
    .from("students")
    .select(
      "full_name, date_of_birth, gender, admission_number, student_guardians(relationship, guardians(full_name, phone, whatsapp_number, email, whatsapp_opt_in)), student_section_enrollments(status, left_on, class_id, section_id)",
    )
    .eq("school_id", schoolId)
    .order("full_name");

  const sectionNameById = new Map(sections.map((row) => [row.id, row.name]));

  return {
    success: true,
    blocked: false,
    classSections,
    students: (students ?? []).map((student) => {
      const enrollments = Array.isArray(student.student_section_enrollments)
        ? student.student_section_enrollments
        : [];
      const active = enrollments.find(
        (row) => row.status === "active" && !row.left_on,
      );
      const guardians = Array.isArray(student.student_guardians)
        ? student.student_guardians
        : [];

      return {
        fullName: student.full_name,
        dateOfBirth: student.date_of_birth ?? "",
        gender: (student.gender as "" | "male" | "female" | "other") ?? "",
        admissionNumber: student.admission_number,
        className: active ? (classNameById.get(active.class_id) ?? "") : "",
        sectionName: active
          ? (sectionNameById.get(active.section_id) ?? "")
          : "",
        guardians: guardians.map((link) => {
          const guardian = link.guardians as
            | {
                full_name: string;
                phone: string | null;
                whatsapp_number: string | null;
                email: string | null;
                whatsapp_opt_in: boolean;
              }
            | {
                full_name: string;
                phone: string | null;
                whatsapp_number: string | null;
                email: string | null;
                whatsapp_opt_in: boolean;
              }[]
            | null;
          const resolved = Array.isArray(guardian) ? guardian[0] : guardian;
          return {
            fullName: resolved?.full_name ?? "",
            relationship: link.relationship,
            phone: resolved?.phone ?? "",
            whatsappNumber: resolved?.whatsapp_number ?? "",
            email: resolved?.email ?? "",
            whatsappOptIn: resolved?.whatsapp_opt_in ?? false,
          };
        }),
      };
    }),
  };
}

export async function saveStudentsAction(formData: FormData): Promise<Result> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const intent = String(formData.get("intent") ?? "save");

  let rows: StudentFormRow[] = [];
  try {
    rows = JSON.parse(String(formData.get("students") ?? "[]")) as StudentFormRow[];
  } catch {
    return { success: false, error: "Could not read student data." };
  }

  const classesResult = await getActiveYearClassesForSchool(supabase, schoolId);
  if ("error" in classesResult) {
    return { success: false, error: classesResult.error };
  }
  if ("blocked" in classesResult) {
    return { success: false, error: "Complete Classes and Sections first." };
  }

  const classIds = classesResult.classes.map((row) => row.id);
  const { data: sections } = await supabase
    .from("sections")
    .select("id, name, class_id")
    .in("class_id", classIds);

  const classNameById = new Map(
    classesResult.classes.map((row) => [row.id, row.name]),
  );
  const pairKey = (className: string, sectionName: string) =>
    `${className.toLowerCase()}::${sectionName.toLowerCase()}`;
  const sectionByPair = new Map(
    (sections ?? []).map((section) => [
      pairKey(classNameById.get(section.class_id) ?? "", section.name),
      { classId: section.class_id, sectionId: section.id },
    ]),
  );

  const fieldErrors = validateStudentRows(
    rows,
    (sections ?? []).map((section) => ({
      className: classNameById.get(section.class_id) ?? "",
      sectionName: section.name,
    })),
    { requireAtLeastOne: intent === "next" },
  );
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const trimmed = trimStudentRows(rows);

  if (intent === "save" && trimmed.length === 0) {
    const { count } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId);
    if ((count ?? 0) > 0) {
      return {
        success: false,
        error:
          "Saving an empty student list would remove all students. Add at least one student, or keep existing rows.",
      };
    }
  }

  const { data: existingStudents } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", schoolId);
  const existingIds = (existingStudents ?? []).map((row) => row.id);
  if (existingIds.length > 0) {
    const { data: guardianLinks } = await supabase
      .from("student_guardians")
      .select("guardian_id")
      .in("student_id", existingIds);
    const guardianIds = Array.from(
      new Set((guardianLinks ?? []).map((row) => row.guardian_id).filter(Boolean)),
    );

    const { error: enrollmentDeleteError } = await supabase
      .from("student_section_enrollments")
      .delete()
      .in("student_id", existingIds);
    if (enrollmentDeleteError) {
      return { success: false, error: enrollmentDeleteError.message };
    }

    const { error: linkDeleteError } = await supabase
      .from("student_guardians")
      .delete()
      .in("student_id", existingIds);
    if (linkDeleteError) {
      return { success: false, error: linkDeleteError.message };
    }

    const { error: studentsDeleteError } = await supabase
      .from("students")
      .delete()
      .eq("school_id", schoolId);
    if (studentsDeleteError) {
      return { success: false, error: studentsDeleteError.message };
    }

    if (guardianIds.length > 0) {
      await supabase.from("guardians").delete().in("id", guardianIds);
    }
  }

  for (const row of trimmed) {
    const pair = sectionByPair.get(pairKey(row.className, row.sectionName));
    if (!pair) {
      return {
        success: false,
        error: `Could not resolve ${row.className} / ${row.sectionName}.`,
      };
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .insert({
        school_id: schoolId,
        full_name: row.fullName,
        date_of_birth: row.dateOfBirth || null,
        gender: row.gender || null,
        admission_number: row.admissionNumber,
        status: "active",
      })
      .select("id")
      .single();

    if (studentError || !student) {
      return {
        success: false,
        error: studentError?.message ?? "Could not save student.",
      };
    }

    const primaryGuardian = row.guardians[0];
    if (primaryGuardian?.fullName) {
      const { data: guardian, error: guardianError } = await supabase
        .from("guardians")
        .insert({
          school_id: schoolId,
          full_name: primaryGuardian.fullName,
          phone: primaryGuardian.phone || null,
          whatsapp_number: primaryGuardian.whatsappNumber || null,
          email: primaryGuardian.email || null,
          whatsapp_opt_in: primaryGuardian.whatsappOptIn,
        })
        .select("id")
        .single();

      if (guardianError || !guardian) {
        return {
          success: false,
          error: guardianError?.message ?? "Could not save guardian.",
        };
      }

      const { error: linkError } = await supabase.from("student_guardians").insert({
        student_id: student.id,
        guardian_id: guardian.id,
        relationship: primaryGuardian.relationship || "parent",
        is_primary: true,
      });
      if (linkError) {
        return { success: false, error: linkError.message };
      }
    }

    const { error: enrollmentError } = await supabase
      .from("student_section_enrollments")
      .insert({
        student_id: student.id,
        academic_year_id: classesResult.academicYear.id,
        class_id: pair.classId,
        section_id: pair.sectionId,
        enrolled_on: new Date().toISOString().slice(0, 10),
        status: "active",
        enrollment_type: "new_admission",
      });

    if (enrollmentError) {
      return { success: false, error: enrollmentError.message };
    }
  }

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "Students saved successfully." };
}
