import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_ONBOARDING_PATH,
  getOnboardingStepHref,
  type OnboardingStepSlug,
} from "@/lib/onboarding/steps";

export type OnboardingProgress = {
  nextStep: OnboardingStepSlug;
  nextHref: string;
  counts: {
    classes: number;
    sections: number;
    subjects: number;
    houses: number;
    clubs: number;
    teachers: number;
    students: number;
    exams: number;
  };
  timetableSkipped: boolean;
  timetableConfigured: boolean;
};

async function countRows(
  supabase: SupabaseClient,
  table: string,
  filters: Record<string, string>,
  options?: { activeOnly?: boolean },
) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  if (options?.activeOnly) {
    query = query.is("archived_at", null);
  }
  const { count } = await query;
  return count ?? 0;
}

export async function getOnboardingProgress(
  supabase: SupabaseClient,
  schoolId: string,
): Promise<OnboardingProgress | { error: string }> {
  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select(
      "academic_year_start_month, timetable_skipped, houses_clubs_completed",
    )
    .eq("id", schoolId)
    .maybeSingle();

  if (schoolError || !school) {
    return { error: schoolError?.message ?? "Could not load school." };
  }

  const { data: activeYear } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle();

  const academicYearId = activeYear?.id ?? null;

  const [classes, subjects, houses, clubs, teachers, students, exams, terms] =
    await Promise.all([
      academicYearId
        ? countRows(supabase, "classes", { academic_year_id: academicYearId })
        : Promise.resolve(0),
      countRows(supabase, "subjects", { school_id: schoolId }, { activeOnly: true }),
      countRows(supabase, "houses", { school_id: schoolId }, { activeOnly: true }),
      countRows(supabase, "clubs", { school_id: schoolId }, { activeOnly: true }),
      countRows(supabase, "teacher_employments", {
        school_id: schoolId,
        status: "active",
      }),
      countRows(supabase, "student_admissions", {
        school_id: schoolId,
        status: "active",
      }),
      academicYearId
        ? countRows(supabase, "exam_definitions", {
            academic_year_id: academicYearId,
          }, { activeOnly: true })
        : Promise.resolve(0),
      academicYearId
        ? countRows(supabase, "terms", { academic_year_id: academicYearId })
        : Promise.resolve(0),
    ]);

  let sections = 0;
  if (academicYearId && classes > 0) {
    const { data: classRows } = await supabase
      .from("classes")
      .select("id")
      .eq("academic_year_id", academicYearId);
    const classIds = (classRows ?? []).map((row) => row.id);
    if (classIds.length > 0) {
      const { count } = await supabase
        .from("sections")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds);
      sections = count ?? 0;
    }
  }

  let timetableConfigured = false;
  if (academicYearId) {
    const { count } = await supabase
      .from("period_definitions")
      .select("id", { count: "exact", head: true })
      .eq("academic_year_id", academicYearId);
    timetableConfigured = (count ?? 0) > 0;
  }

  let nextStep: OnboardingStepSlug = "school-identity";

  if (!school.academic_year_start_month) {
    nextStep = "school-identity";
  } else if (terms < 1) {
    nextStep = "terms";
  } else if (classes < 1) {
    nextStep = "classes";
  } else if (sections < 1) {
    nextStep = "sections";
  } else if (subjects < 1) {
    nextStep = "subjects";
  } else if (!school.houses_clubs_completed) {
    nextStep = "houses-clubs";
  } else if (teachers < 1) {
    nextStep = "staff";
  } else if (students < 1) {
    nextStep = "students";
  } else if (!timetableConfigured && !school.timetable_skipped) {
    nextStep = "timetable";
  } else if (exams < 1) {
    nextStep = "exams";
  } else {
    nextStep = "review";
  }

  return {
    nextStep,
    nextHref: getOnboardingStepHref(nextStep),
    counts: {
      classes,
      sections,
      subjects,
      houses,
      clubs,
      teachers,
      students,
      exams,
    },
    timetableSkipped: Boolean(school.timetable_skipped),
    timetableConfigured,
  };
}

export function getDefaultOnboardingResumeHref(
  progress: OnboardingProgress | null,
) {
  return progress?.nextHref ?? DEFAULT_ONBOARDING_PATH;
}
