import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function assertStudentInSchool(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<{
  admissionId: string;
  studentProfileId: string;
  personId: string;
  bloodGroup: string | null;
  medicalNotes: string | null;
  studentGlobalId: string;
} | null> {
  const { data: admission } = await supabase
    .from("student_admissions")
    .select("id, student_profile_id, status")
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .maybeSingle();

  if (!admission) {
    return null;
  }

  const { data: profile } = await supabase
    .from("student_profiles")
    .select("id, person_id, global_id, blood_group, medical_notes")
    .eq("id", studentProfileId)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  return {
    admissionId: admission.id,
    studentProfileId: profile.id,
    personId: profile.person_id,
    bloodGroup: profile.blood_group,
    medicalNotes: profile.medical_notes,
    studentGlobalId: profile.global_id,
  };
}

export async function resolveActivePlacement(
  supabase: Supabase,
  admissionId: string,
): Promise<{
  academicYearId: string;
  classId: string;
  sectionId: string;
} | null> {
  const { data } = await supabase
    .from("student_academic_years")
    .select("academic_year_id, class_id, section_id")
    .eq("admission_id", admissionId)
    .eq("status", "active")
    .is("left_on", null)
    .order("enrolled_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return {
    academicYearId: data.academic_year_id,
    classId: data.class_id,
    sectionId: data.section_id,
  };
}
