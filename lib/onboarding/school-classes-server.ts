import { getActiveAcademicYearForSchool } from "@/lib/onboarding/academic-year-server";

type SupabaseClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

export type SchoolClassRow = {
  id: string;
  name: string;
  displayOrder: number;
  capacity: number | null;
};

export async function getActiveYearClassesForSchool(
  supabase: SupabaseClient,
  schoolId: string,
): Promise<
  | { blocked: true; reason: "missing_prerequisites" | "no_classes" }
  | { error: string }
  | {
      academicYear: { id: string; label: string };
      classes: SchoolClassRow[];
    }
> {
  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("academic_year_start_month")
    .eq("id", schoolId)
    .maybeSingle();

  if (schoolError || !school?.academic_year_start_month) {
    return { blocked: true, reason: "missing_prerequisites" };
  }

  const academicYearResult = await getActiveAcademicYearForSchool(
    supabase,
    schoolId,
    school.academic_year_start_month,
    { createIfMissing: false },
  );

  if ("error" in academicYearResult) {
    return { error: academicYearResult.error };
  }

  if ("missing" in academicYearResult) {
    return { blocked: true, reason: "missing_prerequisites" };
  }

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name, display_order, capacity")
    .eq("academic_year_id", academicYearResult.academicYear.id)
    .order("display_order", { ascending: true });

  if (classesError) {
    return { error: classesError.message };
  }

  const classRows = (classes ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    displayOrder: row.display_order,
    capacity: row.capacity,
  }));

  if (classRows.length === 0) {
    return { blocked: true, reason: "no_classes" };
  }

  return {
    academicYear: academicYearResult.academicYear,
    classes: classRows,
  };
}

export async function verifyOwnedClassIds(
  supabase: SupabaseClient,
  academicYearId: string,
  classIds: string[],
): Promise<
  | { ownedClassIds: Set<string> }
  | { error: string; rejectedClassId?: string }
> {
  const { data: ownedClasses, error: ownedClassesError } = await supabase
    .from("classes")
    .select("id")
    .eq("academic_year_id", academicYearId);

  if (ownedClassesError) {
    return { error: ownedClassesError.message };
  }

  const ownedClassIds = new Set((ownedClasses ?? []).map((row) => row.id));

  for (const classId of classIds) {
    if (!ownedClassIds.has(classId)) {
      return {
        error: "One or more classes are not in your school.",
        rejectedClassId: classId,
      };
    }
  }

  return { ownedClassIds };
}
