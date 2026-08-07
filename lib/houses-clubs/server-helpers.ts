import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function assertHouseOwned(
  supabase: Supabase,
  schoolId: string,
  houseId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("houses")
    .select("id")
    .eq("id", houseId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertClubOwned(
  supabase: Supabase,
  schoolId: string,
  clubId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("clubs")
    .select("id")
    .eq("id", clubId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertStudentAdmitted(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("student_admissions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .eq("status", "active")
    .maybeSingle();
  return Boolean(data);
}

export async function assertEmploymentOwned(
  supabase: Supabase,
  schoolId: string,
  employmentId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("teacher_employments")
    .select("id")
    .eq("id", employmentId)
    .eq("school_id", schoolId)
    .eq("status", "active")
    .maybeSingle();
  return Boolean(data);
}

export async function assertYearOwned(
  supabase: Supabase,
  schoolId: string,
  academicYearId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", academicYearId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

/** Keep admission.house_id aligned with active house memberships. */
export async function syncAdmissionHousePointer(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<void> {
  const { data: membership } = await supabase
    .from("house_memberships")
    .select("house_id")
    .eq("student_profile_id", studentProfileId)
    .is("left_on", null)
    .order("joined_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("student_admissions")
    .update({
      house_id: membership?.house_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .eq("status", "active");
}
