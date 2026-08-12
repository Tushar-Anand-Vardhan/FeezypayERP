import type { createClient } from "@/lib/supabase/server";
import { listActiveStudentsInSection } from "@/lib/attendance/server-helpers";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type TeacherSectionOption = {
  id: string;
  label: string;
  /** True when this employment is the section class teacher. */
  isHomeClassroom: boolean;
};

export async function getActiveAcademicYearId(
  supabase: Supabase,
  schoolId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .is("archived_at", null)
    .maybeSingle();
  if (data?.id) return data.id;
  const { data: fallback } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .order("label", { ascending: false })
    .limit(1)
    .maybeSingle();
  return fallback?.id ?? null;
}

export async function loadSectionRosterWithNames(
  supabase: Supabase,
  sectionId: string,
): Promise<Array<{ studentProfileId: string; fullName: string }>> {
  const ids = await listActiveStudentsInSection(supabase, sectionId);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("student_profiles")
    .select("id, persons(full_name)")
    .in("id", ids);

  return (profiles ?? []).map((p) => {
    const person = p.persons as
      | { full_name?: string }
      | { full_name?: string }[]
      | null;
    const name = Array.isArray(person)
      ? person[0]?.full_name
      : person?.full_name;
    return {
      studentProfileId: p.id,
      fullName: name ?? p.id.slice(0, 8),
    };
  });
}

function sectionLabelFromJoin(row: {
  section_id?: string | null;
  sections?: unknown;
}): string {
  const sec = row.sections as
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
  const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
  return [className, s?.name].filter(Boolean).join(" · ") || row.section_id || "";
}

/**
 * Sections for attendance / students.
 * Prefer class-teacher (home classroom) sections, then timetable assignments,
 * then all school sections as last resort.
 */
export async function listTeacherSections(
  supabase: Supabase,
  schoolId: string,
  employmentId: string | null,
): Promise<TeacherSectionOption[]> {
  const map = new Map<string, TeacherSectionOption>();

  if (employmentId) {
    const { data: homeSections } = await supabase
      .from("sections")
      .select("id, name, classes!inner(name, school_id)")
      .eq("class_teacher_id", employmentId)
      .eq("classes.school_id", schoolId)
      .is("archived_at", null)
      .limit(50);

    for (const s of homeSections ?? []) {
      const cls = s.classes as
        | { name?: string }
        | { name?: string }[]
        | null;
      const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
      map.set(s.id, {
        id: s.id,
        label: [className, s.name].filter(Boolean).join(" · ") || s.id,
        isHomeClassroom: true,
      });
    }

    const { data: slots } = await supabase
      .from("timetable_slots")
      .select("section_id, sections(id, name, classes(name))")
      .eq("teacher_id", employmentId)
      .not("section_id", "is", null)
      .limit(200);

    for (const row of slots ?? []) {
      if (!row.section_id) continue;
      const existing = map.get(row.section_id);
      if (existing) continue;
      map.set(row.section_id, {
        id: row.section_id,
        label: sectionLabelFromJoin(row),
        isHomeClassroom: false,
      });
    }

    if (map.size > 0) {
      return [...map.values()].sort((a, b) => {
        if (a.isHomeClassroom !== b.isHomeClassroom) {
          return a.isHomeClassroom ? -1 : 1;
        }
        return a.label.localeCompare(b.label);
      });
    }
  }

  const { data: sections } = await supabase
    .from("sections")
    .select("id, name, class_teacher_id, classes!inner(name, school_id)")
    .eq("classes.school_id", schoolId)
    .is("archived_at", null)
    .limit(100);

  return (sections ?? []).map((s) => {
    const cls = s.classes as
      | { name?: string }
      | { name?: string }[]
      | null;
    const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
    return {
      id: s.id,
      label: [className, s.name].filter(Boolean).join(" · ") || s.id,
      isHomeClassroom: Boolean(
        employmentId && s.class_teacher_id === employmentId,
      ),
    };
  });
}

/** Subject ids this employment teaches in a section (timetable slots). */
export async function listTeacherSubjectsForSection(
  supabase: Supabase,
  employmentId: string,
  sectionId: string,
): Promise<Array<{ subjectId: string; name: string }>> {
  const { data } = await supabase
    .from("timetable_slots")
    .select("subject_id, subjects(id, name)")
    .eq("teacher_id", employmentId)
    .eq("section_id", sectionId)
    .not("subject_id", "is", null)
    .limit(100);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (!row.subject_id) continue;
    const sub = row.subjects as
      | { id?: string; name?: string }
      | { id?: string; name?: string }[]
      | null;
    const s = Array.isArray(sub) ? sub[0] : sub;
    map.set(row.subject_id, s?.name ?? row.subject_id);
  }
  return [...map.entries()].map(([subjectId, name]) => ({ subjectId, name }));
}
