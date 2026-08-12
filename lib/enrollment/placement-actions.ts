"use server";

import { revalidatePath } from "next/cache";
import {
  assignRollNumbers,
  isRollStrategy,
  type RollStrategy,
} from "@/lib/enrollment/roll-assignment";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import { syncStudentMembership } from "@/lib/membership/sync";
import { parseCsv } from "@/lib/onboarding/csv";

export type EnrollmentOpsResult =
  | { success: true; message: string; placed?: number; rollsAssigned?: number }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

function revalidate() {
  revalidatePath("/dashboard/principal");
  revalidatePath("/dashboard/principal/students");
  revalidatePath("/dashboard/principal/enroll");
  revalidatePath("/dashboard/principal/promote");
  revalidatePath("/dashboard/teacher");
  revalidatePath("/onboarding", "layout");
}

export const ENROLLMENT_CSV_HEADERS = [
  "admission_number",
  "class_name",
  "section_name",
] as const;

export async function listEnrollmentPoolAction(academicYearId: string): Promise<
  | {
      success: true;
      academicYearId: string;
      years: Array<{ id: string; label: string; isActive: boolean }>;
      sections: Array<{
        id: string;
        name: string;
        classId: string;
        className: string;
      }>;
      students: Array<{
        admissionId: string;
        studentProfileId: string;
        fullName: string;
        admissionNumber: string | null;
        studentAcademicYearId: string | null;
        sectionId: string | null;
        className: string | null;
        sectionName: string | null;
        rollNumber: string | null;
      }>;
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

  const { data: yearOk } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", academicYearId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  if (!yearOk) {
    return { success: false, error: "Academic year not found." };
  }

  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name, sections(id, name)")
    .eq("academic_year_id", academicYearId)
    .is("archived_at", null)
    .order("display_order", { ascending: true });

  const sections: Array<{
    id: string;
    name: string;
    classId: string;
    className: string;
  }> = [];
  for (const cls of classRows ?? []) {
    const secs = Array.isArray(cls.sections)
      ? cls.sections
      : cls.sections
        ? [cls.sections]
        : [];
    for (const s of secs as Array<{ id: string; name: string }>) {
      sections.push({
        id: s.id,
        name: s.name,
        classId: cls.id,
        className: cls.name,
      });
    }
  }

  const { data: admissions, error } = await supabase
    .from("student_admissions")
    .select(
      "id, admission_number, student_profile_id, student_profiles(persons(full_name))",
    )
    .eq("school_id", schoolId)
    .eq("status", "active")
    .order("admission_number");

  if (error) {
    return { success: false, error: error.message };
  }

  const admissionIds = (admissions ?? []).map((a) => a.id);
  const placementByAdmission = new Map<
    string,
    {
      id: string;
      section_id: string;
      roll_number: string | null;
      className: string | null;
      sectionName: string | null;
    }
  >();

  if (admissionIds.length > 0) {
    const { data: placements } = await supabase
      .from("student_academic_years")
      .select(
        "id, admission_id, section_id, roll_number, classes(name), sections(name)",
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
        section_id: p.section_id,
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
      studentAcademicYearId: placement?.id ?? null,
      sectionId: placement?.section_id ?? null,
      className: placement?.className ?? null,
      sectionName: placement?.sectionName ?? null,
      rollNumber: placement?.roll_number ?? null,
    };
  });

  return {
    success: true,
    academicYearId,
    years: (years ?? []).map((y) => ({
      id: y.id,
      label: y.label,
      isActive: Boolean(y.is_active),
    })),
    sections,
    students,
  };
}

export async function placeStudentsInSectionAction(input: {
  academicYearId: string;
  sectionId: string;
  admissionIds: string[];
  rollStrategy?: RollStrategy | null;
}): Promise<EnrollmentOpsResult> {
  const context = await getAuthenticatedSchoolContext(
    "enrollment.placement.edit",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const admissionIds = [...new Set(input.admissionIds.filter(Boolean))];
  if (admissionIds.length === 0) {
    return { success: false, error: "Select at least one student." };
  }

  const { data: yearOk } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", input.academicYearId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!yearOk) {
    return { success: false, error: "Academic year not found." };
  }

  const { data: section } = await supabase
    .from("sections")
    .select("id, class_id, classes!inner(academic_year_id, academic_years!inner(school_id))")
    .eq("id", input.sectionId)
    .is("archived_at", null)
    .maybeSingle();

  const cls = section?.classes as
    | {
        academic_year_id?: string;
        academic_years?:
          | { school_id?: string }
          | { school_id?: string }[]
          | null;
      }
    | {
        academic_year_id?: string;
        academic_years?:
          | { school_id?: string }
          | { school_id?: string }[]
          | null;
      }[]
    | null;
  const classMeta = Array.isArray(cls) ? cls[0] : cls;
  const yearRel = Array.isArray(classMeta?.academic_years)
    ? classMeta?.academic_years[0]
    : classMeta?.academic_years;
  if (
    !section ||
    yearRel?.school_id !== schoolId ||
    classMeta?.academic_year_id !== input.academicYearId
  ) {
    return { success: false, error: "Section not found for this year." };
  }

  const { data: admissions } = await supabase
    .from("student_admissions")
    .select("id, student_profile_id, status")
    .eq("school_id", schoolId)
    .in("id", admissionIds);

  if ((admissions ?? []).length !== admissionIds.length) {
    return { success: false, error: "One or more admissions were not found." };
  }
  if ((admissions ?? []).some((a) => a.status !== "active")) {
    return {
      success: false,
      error: "Only active admissions can be placed in a section.",
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const placedSayIds: string[] = [];
  const namesBySay = new Map<string, string>();

  for (const admission of admissions ?? []) {
    const { data: existing } = await supabase
      .from("student_academic_years")
      .select("id")
      .eq("admission_id", admission.id)
      .eq("academic_year_id", input.academicYearId)
      .eq("status", "active")
      .is("left_on", null)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("student_academic_years")
        .update({
          class_id: section.class_id,
          section_id: section.id,
        })
        .eq("id", existing.id);
      if (error) {
        return { success: false, error: error.message };
      }
      placedSayIds.push(existing.id);
    } else {
      const { data: inserted, error } = await supabase
        .from("student_academic_years")
        .insert({
          admission_id: admission.id,
          academic_year_id: input.academicYearId,
          class_id: section.class_id,
          section_id: section.id,
          enrolled_on: today,
          status: "active",
          enrollment_type: "new_admission",
        })
        .select("id")
        .single();
      if (error || !inserted) {
        return {
          success: false,
          error: error?.message ?? "Could not create placement.",
        };
      }
      placedSayIds.push(inserted.id);
    }

    await syncStudentMembership(supabase, admission.id);
  }

  // Resolve names for optional roll assignment
  const { data: nameRows } = await supabase
    .from("student_academic_years")
    .select(
      "id, student_admissions(student_profiles(persons(full_name)))",
    )
    .in("id", placedSayIds);

  for (const row of nameRows ?? []) {
    const adm = row.student_admissions as
      | {
          student_profiles?:
            | { persons?: { full_name?: string } | { full_name?: string }[] }
            | { persons?: { full_name?: string } | { full_name?: string }[] }[];
        }
      | {
          student_profiles?:
            | { persons?: { full_name?: string } | { full_name?: string }[] }
            | { persons?: { full_name?: string } | { full_name?: string }[] }[];
        }[]
      | null;
    const a = Array.isArray(adm) ? adm[0] : adm;
    const sp = Array.isArray(a?.student_profiles)
      ? a?.student_profiles[0]
      : a?.student_profiles;
    const person = Array.isArray(sp?.persons) ? sp?.persons[0] : sp?.persons;
    namesBySay.set(row.id, person?.full_name ?? "Student");
  }

  let rollsAssigned = 0;
  if (input.rollStrategy && isRollStrategy(input.rollStrategy)) {
    const assignments = assignRollNumbers(
      placedSayIds.map((id) => ({
        studentAcademicYearId: id,
        fullName: namesBySay.get(id) ?? "Student",
      })),
      input.rollStrategy,
    );
    for (const a of assignments) {
      const { error } = await supabase
        .from("student_academic_years")
        .update({
          roll_number: a.rollNumber,
        })
        .eq("id", a.studentAcademicYearId);
      if (error) {
        return { success: false, error: error.message };
      }
      rollsAssigned += 1;
    }
  }

  revalidate();
  return {
    success: true,
    message: `Placed ${admissionIds.length} student(s) in the section.`,
    placed: admissionIds.length,
    rollsAssigned,
  };
}

export async function assignSectionRollNumbersAction(input: {
  academicYearId: string;
  sectionId: string;
  strategy: string;
}): Promise<EnrollmentOpsResult> {
  const context = await getAuthenticatedSchoolContext(
    "enrollment.placement.edit",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }
  if (!isRollStrategy(input.strategy)) {
    return { success: false, error: "Invalid roll strategy." };
  }

  const { supabase, schoolId } = context;

  const { data: section } = await supabase
    .from("sections")
    .select(
      "id, classes!inner(academic_year_id, academic_years!inner(school_id))",
    )
    .eq("id", input.sectionId)
    .maybeSingle();
  const cls = section?.classes as
    | {
        academic_year_id?: string;
        academic_years?:
          | { school_id?: string }
          | { school_id?: string }[]
          | null;
      }
    | {
        academic_year_id?: string;
        academic_years?:
          | { school_id?: string }
          | { school_id?: string }[]
          | null;
      }[]
    | null;
  const classMeta = Array.isArray(cls) ? cls[0] : cls;
  const yearRel = Array.isArray(classMeta?.academic_years)
    ? classMeta?.academic_years[0]
    : classMeta?.academic_years;
  if (
    !section ||
    yearRel?.school_id !== schoolId ||
    classMeta?.academic_year_id !== input.academicYearId
  ) {
    return { success: false, error: "Section not found for this year." };
  }

  const { data: placements, error } = await supabase
    .from("student_academic_years")
    .select(
      "id, student_admissions(student_profiles(persons(full_name)))",
    )
    .eq("academic_year_id", input.academicYearId)
    .eq("section_id", input.sectionId)
    .eq("status", "active")
    .is("left_on", null);

  if (error) {
    return { success: false, error: error.message };
  }
  if (!placements || placements.length === 0) {
    return { success: false, error: "No active students in this section." };
  }

  const candidates = placements.map((row) => {
    const adm = row.student_admissions as
      | {
          student_profiles?:
            | { persons?: { full_name?: string } | { full_name?: string }[] }
            | { persons?: { full_name?: string } | { full_name?: string }[] }[];
        }
      | {
          student_profiles?:
            | { persons?: { full_name?: string } | { full_name?: string }[] }
            | { persons?: { full_name?: string } | { full_name?: string }[] }[];
        }[]
      | null;
    const a = Array.isArray(adm) ? adm[0] : adm;
    const sp = Array.isArray(a?.student_profiles)
      ? a?.student_profiles[0]
      : a?.student_profiles;
    const person = Array.isArray(sp?.persons) ? sp?.persons[0] : sp?.persons;
    return {
      studentAcademicYearId: row.id,
      fullName: person?.full_name ?? "Student",
    };
  });

  const assignments = assignRollNumbers(candidates, input.strategy);
  for (const a of assignments) {
    const { error: updError } = await supabase
      .from("student_academic_years")
      .update({
        roll_number: a.rollNumber,
      })
      .eq("id", a.studentAcademicYearId);
    if (updError) {
      return { success: false, error: updError.message };
    }
  }

  revalidate();
  return {
    success: true,
    message: `Assigned roll numbers (${input.strategy}) to ${assignments.length} student(s).`,
    rollsAssigned: assignments.length,
  };
}

export async function importEnrollmentCsvAction(input: {
  academicYearId: string;
  csvText: string;
  rollStrategy?: RollStrategy | null;
}): Promise<EnrollmentOpsResult> {
  const parsed = parseCsv(input.csvText);
  const required = [...ENROLLMENT_CSV_HEADERS];
  for (const h of required) {
    if (!parsed.headers.includes(h)) {
      return {
        success: false,
        error: `CSV must include columns: ${required.join(", ")}.`,
      };
    }
  }
  if (parsed.rows.length === 0) {
    return { success: false, error: "CSV has no data rows." };
  }

  const context = await getAuthenticatedSchoolContext(
    "enrollment.placement.edit",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }
  const { supabase, schoolId } = context;

  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name, sections(id, name)")
    .eq("academic_year_id", input.academicYearId)
    .is("archived_at", null);

  const pairKey = (c: string, s: string) =>
    `${c.trim().toLowerCase()}::${s.trim().toLowerCase()}`;
  const sectionByPair = new Map<string, string>();
  for (const cls of classRows ?? []) {
    const secs = Array.isArray(cls.sections)
      ? cls.sections
      : cls.sections
        ? [cls.sections]
        : [];
    for (const s of secs as Array<{ id: string; name: string }>) {
      sectionByPair.set(pairKey(cls.name, s.name), s.id);
    }
  }

  const { data: admissions } = await supabase
    .from("student_admissions")
    .select("id, admission_number")
    .eq("school_id", schoolId)
    .eq("status", "active");

  const admissionByNumber = new Map(
    (admissions ?? []).map((a) => [
      a.admission_number.toLowerCase(),
      a.id,
    ]),
  );

  const fieldErrors: Record<string, string> = {};
  const bySection = new Map<string, string[]>();

  parsed.rows.forEach((row, index) => {
    const line = index + 2;
    const admissionNumber = (row.admission_number ?? "").trim();
    const className = (row.class_name ?? "").trim();
    const sectionName = (row.section_name ?? "").trim();
    if (!admissionNumber) {
      fieldErrors[`row-${line}`] = "admission_number is required.";
      return;
    }
    const admissionId = admissionByNumber.get(admissionNumber.toLowerCase());
    if (!admissionId) {
      fieldErrors[`row-${line}`] =
        `No active admission for ${admissionNumber}.`;
      return;
    }
    const sectionId = sectionByPair.get(pairKey(className, sectionName));
    if (!sectionId) {
      fieldErrors[`row-${line}`] =
        `Unknown class/section ${className} / ${sectionName}.`;
      return;
    }
    const list = bySection.get(sectionId) ?? [];
    list.push(admissionId);
    bySection.set(sectionId, list);
  });

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Fix CSV errors before importing (blocking validation).",
      fieldErrors,
    };
  }

  let placed = 0;
  let rollsAssigned = 0;
  for (const [sectionId, ids] of bySection) {
    const result = await placeStudentsInSectionAction({
      academicYearId: input.academicYearId,
      sectionId,
      admissionIds: ids,
      rollStrategy: input.rollStrategy ?? null,
    });
    if (!result.success) {
      return result;
    }
    placed += result.placed ?? ids.length;
    rollsAssigned += result.rollsAssigned ?? 0;
  }

  return {
    success: true,
    message: `Imported placements for ${placed} student(s).`,
    placed,
    rollsAssigned,
  };
}
