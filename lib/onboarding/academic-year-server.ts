import { deriveAcademicYearLabel } from "@/lib/onboarding/academic-year";

type SupabaseClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

export async function getActiveAcademicYearForSchool(
  supabase: SupabaseClient,
  schoolId: string,
  academicYearStartMonth: number,
  options?: { createIfMissing?: boolean },
): Promise<
  | { academicYear: { id: string; label: string } }
  | { error: string }
  | { missing: true }
> {
  const createIfMissing = options?.createIfMissing ?? true;

  const { data: activeYear, error: activeYearError } = await supabase
    .from("academic_years")
    .select("id, label")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle();

  if (activeYearError) {
    return { error: activeYearError.message };
  }

  if (activeYear) {
    return { academicYear: activeYear };
  }

  if (!createIfMissing) {
    return { missing: true };
  }

  const label = deriveAcademicYearLabel(academicYearStartMonth);
  const { data: createdYear, error: createError } = await supabase
    .from("academic_years")
    .insert({
      school_id: schoolId,
      label,
      is_active: true,
    })
    .select("id, label")
    .single();

  if (createError || !createdYear) {
    return { error: createError?.message ?? "Could not create academic year." };
  }

  return { academicYear: createdYear };
}
