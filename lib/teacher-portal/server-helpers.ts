import type { createClient } from "@/lib/supabase/server";
import { listActiveStudentsInSection } from "@/lib/attendance/server-helpers";

type Supabase = Awaited<ReturnType<typeof createClient>>;

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

export async function listTeacherSections(
  supabase: Supabase,
  schoolId: string,
  employmentId: string | null,
): Promise<Array<{ id: string; label: string }>> {
  // Prefer timetable assignments for this employment; fall back to all school sections.
  if (employmentId) {
    const { data } = await supabase
      .from("timetable_slots")
      .select("section_id, sections(id, name, classes(name))")
      .eq("teacher_id", employmentId)
      .not("section_id", "is", null)
      .limit(200);

    const map = new Map<string, string>();
    for (const row of data ?? []) {
      if (!row.section_id) continue;
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
      map.set(
        row.section_id,
        [className, s?.name].filter(Boolean).join(" · ") || row.section_id,
      );
    }
    if (map.size > 0) {
      return [...map.entries()].map(([id, label]) => ({ id, label }));
    }
  }

  const { data: sections } = await supabase
    .from("sections")
    .select("id, name, classes!inner(name, school_id)")
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
    };
  });
}
