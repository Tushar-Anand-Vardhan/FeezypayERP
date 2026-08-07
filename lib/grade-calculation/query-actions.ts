"use server";

import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listGradeCalculationRunsAction(options?: {
  academicYearId?: string;
  classId?: string;
  scope?: string;
  currentOnly?: boolean;
}): Promise<
  | { success: true; runs: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("grade_calculation.read");
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  let query = supabase
    .from("grade_calculation_runs")
    .select(
      "id, academic_year_id, class_id, section_id, subject_id, term_id, scope, run_version, status, inputs_fingerprint, is_current, computed_at, published_at",
    )
    .eq("school_id", schoolId)
    .order("computed_at", { ascending: false });

  if (options?.academicYearId) {
    query = query.eq("academic_year_id", options.academicYearId);
  }
  if (options?.classId) query = query.eq("class_id", options.classId);
  if (options?.scope) query = query.eq("scope", options.scope);
  if (options?.currentOnly !== false) query = query.eq("is_current", true);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, runs: data ?? [] };
}

export async function listGradeResultsAction(options: {
  runId: string;
  resultKind?: string;
  studentProfileId?: string;
}): Promise<
  | { success: true; results: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("grade_calculation.read");
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  let query = supabase
    .from("grade_calculation_results")
    .select("*")
    .eq("school_id", schoolId)
    .eq("run_id", options.runId)
    .eq("is_current", true);

  if (options.resultKind) query = query.eq("result_kind", options.resultKind);
  if (options.studentProfileId) {
    query = query.eq("student_profile_id", options.studentProfileId);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, results: data ?? [] };
}

export async function getGradeRunAction(
  runId: string,
): Promise<
  | { success: true; run: Record<string, unknown> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("grade_calculation.read");
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const { data, error } = await supabase
    .from("grade_calculation_runs")
    .select("*")
    .eq("id", runId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Run not found" };
  return { success: true, run: data };
}
