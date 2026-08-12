"use server";

import { revalidatePath } from "next/cache";
import { syncStaffMembership } from "@/lib/membership/sync";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export type PrincipalOpsResult =
  | { success: true; message: string; id?: string; conflicts?: string[] }
  | { success: false; error: string; conflicts?: string[]; fieldErrors?: Record<string, string> };

function revalidate() {
  revalidatePath("/dashboard/principal");
  revalidatePath("/dashboard/principal/teachers");
  revalidatePath("/dashboard/teacher");
  revalidatePath("/onboarding", "layout");
}

export async function listPrincipalTeachersAction(): Promise<
  | {
      success: true;
      teachers: Array<{
        employmentId: string;
        fullName: string;
        email: string | null;
        designation: string | null;
        status: string;
        subjectIds: string[];
        subjectNames: string[];
        classTeacherSections: Array<{ id: string; label: string }>;
        slotCount: number;
      }>;
      subjects: Array<{ id: string; name: string }>;
      sections: Array<{ id: string; label: string; classTeacherId: string | null }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "workforce.employment.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  const { data: employments, error } = await supabase
    .from("teacher_employments")
    .select(
      "id, designation, status, teacher_profiles(persons(full_name, email))",
    )
    .eq("school_id", schoolId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  const employmentIds = (employments ?? []).map((e) => e.id);
  const subjectByEmployment = new Map<string, Array<{ id: string; name: string }>>();
  if (employmentIds.length > 0) {
    const { data: es } = await supabase
      .from("employment_subjects")
      .select("employment_id, subject_id, subjects(id, name)")
      .in("employment_id", employmentIds);
    for (const row of es ?? []) {
      const sub = row.subjects as
        | { id?: string; name?: string }
        | { id?: string; name?: string }[]
        | null;
      const s = Array.isArray(sub) ? sub[0] : sub;
      if (!s?.id) continue;
      const list = subjectByEmployment.get(row.employment_id) ?? [];
      list.push({ id: s.id, name: s.name ?? s.id });
      subjectByEmployment.set(row.employment_id, list);
    }
  }

  const { data: sections } = await supabase
    .from("sections")
    .select("id, name, class_teacher_id, classes!inner(name, school_id)")
    .eq("classes.school_id", schoolId)
    .is("archived_at", null);

  const classTeacherMap = new Map<string, Array<{ id: string; label: string }>>();
  const sectionOptions: Array<{
    id: string;
    label: string;
    classTeacherId: string | null;
  }> = [];
  for (const sec of sections ?? []) {
    const cls = sec.classes as
      | { name?: string }
      | { name?: string }[]
      | null;
    const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
    const label = [className, sec.name].filter(Boolean).join(" · ") || sec.id;
    sectionOptions.push({
      id: sec.id,
      label,
      classTeacherId: sec.class_teacher_id,
    });
    if (sec.class_teacher_id) {
      const list = classTeacherMap.get(sec.class_teacher_id) ?? [];
      list.push({ id: sec.id, label });
      classTeacherMap.set(sec.class_teacher_id, list);
    }
  }

  const slotCountByTeacher = new Map<string, number>();
  if (employmentIds.length > 0) {
    const { data: slots } = await supabase
      .from("timetable_slots")
      .select("teacher_id")
      .in("teacher_id", employmentIds)
      .is("archived_at", null);
    for (const slot of slots ?? []) {
      if (!slot.teacher_id) continue;
      slotCountByTeacher.set(
        slot.teacher_id,
        (slotCountByTeacher.get(slot.teacher_id) ?? 0) + 1,
      );
    }
  }

  const { data: allSubjects } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .order("name");

  const teachers = (employments ?? []).map((e) => {
    const profile = e.teacher_profiles as
      | {
          persons?:
            | { full_name?: string; email?: string | null }
            | { full_name?: string; email?: string | null }[]
            | null;
        }
      | {
          persons?:
            | { full_name?: string; email?: string | null }
            | { full_name?: string; email?: string | null }[]
            | null;
        }[]
      | null;
    const p = Array.isArray(profile) ? profile[0] : profile;
    const person = Array.isArray(p?.persons) ? p?.persons[0] : p?.persons;
    const subjects = subjectByEmployment.get(e.id) ?? [];
    return {
      employmentId: e.id,
      fullName: person?.full_name ?? "Teacher",
      email: person?.email ?? null,
      designation: e.designation,
      status: e.status,
      subjectIds: subjects.map((s) => s.id),
      subjectNames: subjects.map((s) => s.name),
      classTeacherSections: classTeacherMap.get(e.id) ?? [],
      slotCount: slotCountByTeacher.get(e.id) ?? 0,
    };
  });

  return {
    success: true,
    teachers,
    subjects: (allSubjects ?? []).map((s) => ({ id: s.id, name: s.name })),
    sections: sectionOptions,
  };
}

export async function endTeacherEmploymentAction(
  employmentId: string,
): Promise<PrincipalOpsResult> {
  const context = await getAuthenticatedSchoolContext(
    "workforce.employment.edit",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const today = new Date().toISOString().slice(0, 10);

  const { data: row } = await supabase
    .from("teacher_employments")
    .select("id, status")
    .eq("id", employmentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!row) {
    return { success: false, error: "Employment not found." };
  }
  if (row.status !== "active") {
    return { success: false, error: "Employment is not active." };
  }

  const { error } = await supabase
    .from("teacher_employments")
    .update({
      status: "ended",
      left_on: today,
      updated_at: new Date().toISOString(),
    })
    .eq("id", employmentId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Clear class-teacher assignments pointing at this employment
  await supabase
    .from("sections")
    .update({ class_teacher_id: null })
    .eq("class_teacher_id", employmentId);

  await syncStaffMembership(supabase, employmentId);
  revalidate();
  return {
    success: true,
    message: "Teacher removed from school (employment ended).",
    id: employmentId,
  };
}

/**
 * Replace teachable subjects. Blocks if timetable slots still use a removed
 * subject unless `force` is true.
 */
export async function setEmploymentSubjectsAction(input: {
  employmentId: string;
  subjectIds: string[];
  force?: boolean;
}): Promise<PrincipalOpsResult> {
  const context = await getAuthenticatedSchoolContext(
    "workforce.employment.edit",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: employment } = await supabase
    .from("teacher_employments")
    .select("id")
    .eq("id", input.employmentId)
    .eq("school_id", schoolId)
    .eq("status", "active")
    .maybeSingle();

  if (!employment) {
    return { success: false, error: "Employment not found." };
  }

  const uniqueSubjects = [...new Set(input.subjectIds.filter(Boolean))];

  const { data: current } = await supabase
    .from("employment_subjects")
    .select("subject_id")
    .eq("employment_id", input.employmentId);
  const currentIds = new Set((current ?? []).map((c) => c.subject_id));
  const removed = [...currentIds].filter((id) => !uniqueSubjects.includes(id));

  const conflicts: string[] = [];
  if (removed.length > 0) {
    const { data: slots } = await supabase
      .from("timetable_slots")
      .select("id, subject_id, subjects(name)")
      .eq("teacher_id", input.employmentId)
      .in("subject_id", removed)
      .is("archived_at", null);
    for (const slot of slots ?? []) {
      const sub = slot.subjects as
        | { name?: string }
        | { name?: string }[]
        | null;
      const name = Array.isArray(sub) ? sub[0]?.name : sub?.name;
      conflicts.push(
        `Timetable slot still assigned for subject ${name ?? slot.subject_id}.`,
      );
    }
  }

  if (conflicts.length > 0 && !input.force) {
    return {
      success: false,
      error:
        "Changing subjects would overwrite timetable assignments. Clear those slots first, or confirm force.",
      conflicts,
    };
  }

  if (uniqueSubjects.length > 0) {
    const { data: owned } = await supabase
      .from("subjects")
      .select("id")
      .eq("school_id", schoolId)
      .in("id", uniqueSubjects)
      .is("archived_at", null);
    if ((owned ?? []).length !== uniqueSubjects.length) {
      return { success: false, error: "One or more subjects not found." };
    }
  }

  await supabase
    .from("employment_subjects")
    .delete()
    .eq("employment_id", input.employmentId);

  if (uniqueSubjects.length > 0) {
    const { error } = await supabase.from("employment_subjects").insert(
      uniqueSubjects.map((subject_id) => ({
        employment_id: input.employmentId,
        subject_id,
      })),
    );
    if (error) {
      return { success: false, error: error.message };
    }
  }

  revalidate();
  return {
    success: true,
    message: "Teachable subjects updated.",
    id: input.employmentId,
    conflicts: conflicts.length ? conflicts : undefined,
  };
}

/**
 * Assign class teacher. Warns if another teacher already holds the section
 * unless `force`.
 */
export async function setSectionClassTeacherAction(input: {
  sectionId: string;
  employmentId: string | null;
  force?: boolean;
}): Promise<PrincipalOpsResult> {
  const context = await getAuthenticatedSchoolContext(
    "workforce.employment.edit",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  const { data: section } = await supabase
    .from("sections")
    .select("id, class_teacher_id, name, classes!inner(name, school_id)")
    .eq("id", input.sectionId)
    .eq("classes.school_id", schoolId)
    .maybeSingle();

  if (!section) {
    return { success: false, error: "Section not found." };
  }

  if (input.employmentId) {
    const { data: employment } = await supabase
      .from("teacher_employments")
      .select("id")
      .eq("id", input.employmentId)
      .eq("school_id", schoolId)
      .eq("status", "active")
      .maybeSingle();
    if (!employment) {
      return { success: false, error: "Employment not found." };
    }
  }

  const conflicts: string[] = [];
  if (
    section.class_teacher_id &&
    input.employmentId &&
    section.class_teacher_id !== input.employmentId
  ) {
    conflicts.push(
      "Another teacher is already class teacher for this section.",
    );
  }

  if (conflicts.length > 0 && !input.force) {
    return {
      success: false,
      error: "Confirm overwrite to replace the current class teacher.",
      conflicts,
    };
  }

  const { error } = await supabase
    .from("sections")
    .update({ class_teacher_id: input.employmentId })
    .eq("id", input.sectionId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidate();
  return {
    success: true,
    message: input.employmentId
      ? "Class teacher assigned."
      : "Class teacher cleared.",
    id: input.sectionId,
    conflicts: conflicts.length ? conflicts : undefined,
  };
}
