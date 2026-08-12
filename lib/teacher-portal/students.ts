"use server";

import { createClient } from "@/lib/supabase/server";
import { isMarkingWindowOpen } from "@/lib/assessment/ops-validation";
import {
  getActiveAcademicYearId,
  listTeacherSections,
  listTeacherSubjectsForSection,
  loadSectionRosterWithNames,
} from "@/lib/teacher-portal/server-helpers";
import { listActiveEmployments } from "@/lib/teacher-workspace/server-helpers";

export type TeacherStudentRosterRow = {
  studentProfileId: string;
  fullName: string;
  admissionNumber: string | null;
  rollNumber: string | null;
};

export async function resolveTeacherEmploymentId(
  schoolId: string,
  preferredEmploymentId: string | null,
): Promise<string | null> {
  const supabase = await createClient();
  const employments = await listActiveEmployments(supabase, schoolId);
  if (
    preferredEmploymentId &&
    employments.some((e) => e.employmentId === preferredEmploymentId)
  ) {
    return preferredEmploymentId;
  }
  return employments[0]?.employmentId ?? null;
}

export async function loadTeacherStudentRoster(input: {
  schoolId: string;
  sectionId: string;
}): Promise<TeacherStudentRosterRow[]> {
  const supabase = await createClient();
  const roster = await loadSectionRosterWithNames(supabase, input.sectionId);
  if (roster.length === 0) return [];

  const { data: placements } = await supabase
    .from("student_academic_years")
    .select(
      "roll_number, admission_id, student_admissions!inner(student_profile_id, admission_number)",
    )
    .eq("section_id", input.sectionId)
    .eq("status", "active")
    .is("left_on", null);

  const meta = new Map<
    string,
    { admissionNumber: string | null; rollNumber: string | null }
  >();
  for (const row of placements ?? []) {
    const adm = row.student_admissions as
      | {
          student_profile_id?: string;
          admission_number?: string | null;
        }
      | {
          student_profile_id?: string;
          admission_number?: string | null;
        }[]
      | null;
    const admission = Array.isArray(adm) ? adm[0] : adm;
    const profileId = admission?.student_profile_id;
    if (!profileId) continue;
    meta.set(profileId, {
      admissionNumber: admission?.admission_number ?? null,
      rollNumber: row.roll_number != null ? String(row.roll_number) : null,
    });
  }

  return roster.map((r) => ({
    studentProfileId: r.studentProfileId,
    fullName: r.fullName,
    admissionNumber: meta.get(r.studentProfileId)?.admissionNumber ?? null,
    rollNumber: meta.get(r.studentProfileId)?.rollNumber ?? null,
  }));
}

export async function loadTeacherStudentSheet(input: {
  schoolId: string;
  employmentId: string | null;
  studentProfileId: string;
}): Promise<
  | {
      success: true;
      student: {
        studentProfileId: string;
        fullName: string;
        admissionNumber: string | null;
        sectionId: string | null;
        sectionLabel: string | null;
        className: string | null;
      };
      subjects: Array<{ subjectId: string; name: string }>;
      openSchedules: Array<{
        scheduleId: string;
        examDefinitionId: string;
        subjectId: string;
        label: string;
        maxMarks: number | null;
        markingOpen: boolean;
      }>;
    }
  | { success: false; error: string }
> {
  const supabase = await createClient();
  const academicYearId = await getActiveAcademicYearId(
    supabase,
    input.schoolId,
  );

  const { data: admission } = await supabase
    .from("student_admissions")
    .select("id, admission_number, student_profiles!inner(id, persons(full_name))")
    .eq("school_id", input.schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .maybeSingle();

  if (!admission) {
    return { success: false, error: "Student not found in this school." };
  }

  const profileRel = admission.student_profiles as
    | {
        id?: string;
        persons?:
          | { full_name?: string }
          | { full_name?: string }[]
          | null;
      }
    | {
        id?: string;
        persons?:
          | { full_name?: string }
          | { full_name?: string }[]
          | null;
      }[]
    | null;
  const profile = Array.isArray(profileRel) ? profileRel[0] : profileRel;
  const person = profile?.persons;
  const personRow = Array.isArray(person) ? person[0] : person;
  const fullName =
    personRow?.full_name ?? input.studentProfileId.slice(0, 8);

  let sectionId: string | null = null;
  let sectionLabel: string | null = null;
  let className: string | null = null;

  if (academicYearId) {
    const { data: say } = await supabase
      .from("student_academic_years")
      .select("section_id, sections(id, name, classes(name))")
      .eq("admission_id", admission.id)
      .eq("academic_year_id", academicYearId)
      .eq("status", "active")
      .is("left_on", null)
      .maybeSingle();

    if (say) {
      sectionId = say.section_id ? String(say.section_id) : null;
      const sec = say.sections as
        | {
            name?: string;
            classes?: { name?: string } | { name?: string }[] | null;
          }
        | {
            name?: string;
            classes?: { name?: string } | { name?: string }[] | null;
          }[]
        | null;
      const s = Array.isArray(sec) ? sec[0] : sec;
      const cls = s?.classes;
      className = Array.isArray(cls) ? cls[0]?.name ?? null : cls?.name ?? null;
      sectionLabel = [className, s?.name].filter(Boolean).join(" · ") || null;
    }
  }

  let subjects: Array<{ subjectId: string; name: string }> = [];
  if (input.employmentId && sectionId) {
    subjects = await listTeacherSubjectsForSection(
      supabase,
      input.employmentId,
      sectionId,
    );
  }

  const subjectIds = new Set(subjects.map((s) => s.subjectId));
  const openSchedules: Array<{
    scheduleId: string;
    examDefinitionId: string;
    subjectId: string;
    label: string;
    maxMarks: number | null;
    markingOpen: boolean;
  }> = [];

  if (academicYearId && subjectIds.size > 0) {
    const { data: scheduleRows } = await supabase
      .from("exam_subject_schedules")
      .select(
        "id, exam_definition_id, subject_id, section_id, max_marks, marking_opens_at, marking_closes_at, subjects(name), exam_definitions!inner(name, academic_year_id, publishing_status, school_id)",
      )
      .eq("exam_definitions.school_id", input.schoolId)
      .eq("exam_definitions.academic_year_id", academicYearId)
      .is("archived_at", null)
      .limit(300);

    for (const row of scheduleRows ?? []) {
      const exam = row.exam_definitions as
        | { name?: string; publishing_status?: string }
        | { name?: string; publishing_status?: string }[]
        | null;
      const ex = Array.isArray(exam) ? exam[0] : exam;
      const status = ex?.publishing_status ?? "";
      if (!["scheduled", "published", "locked"].includes(status)) continue;
      const subjectId = String(row.subject_id ?? "");
      if (!subjectIds.has(subjectId)) continue;
      if (
        row.section_id &&
        sectionId &&
        String(row.section_id) !== sectionId
      ) {
        continue;
      }
      const sub = row.subjects as
        | { name?: string }
        | { name?: string }[]
        | null;
      const subjectName = Array.isArray(sub) ? sub[0]?.name : sub?.name;
      const markingOpen = isMarkingWindowOpen({
        markingOpensAt: row.marking_opens_at
          ? String(row.marking_opens_at)
          : null,
        markingClosesAt: row.marking_closes_at
          ? String(row.marking_closes_at)
          : null,
      });
      openSchedules.push({
        scheduleId: String(row.id),
        examDefinitionId: String(row.exam_definition_id),
        subjectId,
        label: [ex?.name, subjectName].filter(Boolean).join(" · ") || row.id,
        maxMarks: row.max_marks != null ? Number(row.max_marks) : null,
        markingOpen,
      });
    }
  }

  return {
    success: true,
    student: {
      studentProfileId: input.studentProfileId,
      fullName,
      admissionNumber: admission.admission_number ?? null,
      sectionId,
      sectionLabel,
      className,
    },
    subjects,
    openSchedules,
  };
}

export { listTeacherSections, getActiveAcademicYearId };
