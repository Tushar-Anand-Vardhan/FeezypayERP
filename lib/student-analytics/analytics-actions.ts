"use server";

import { revalidatePath } from "next/cache";
import { buildStudentAnalyticsReport } from "@/lib/student-analytics/aggregate";
import { validateGenerateInput } from "@/lib/student-analytics/rules";
import {
  assertStudentInSchool,
  assertYearOwned,
  getActorId,
  writeAnalyticsAudit,
} from "@/lib/student-analytics/server-helpers";
import type {
  GenerateStudentAnalyticsInput,
  StudentAnalyticsActionResult,
} from "@/lib/student-analytics/types";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard/students");
}

/**
 * Compute deterministic student analytics (optionally persist E22 snapshot).
 * Never writes attendance/marks/behaviour OLTP facts.
 */
export async function generateStudentAnalyticsAction(
  input: GenerateStudentAnalyticsInput,
): Promise<StudentAnalyticsActionResult> {
  const context = await getAuthenticatedSchoolContext("analytics.dashboard.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateGenerateInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }
  if (
    !(await assertStudentInSchool(supabase, schoolId, input.studentProfileId))
  ) {
    return { success: false, error: "Student not found in this school." };
  }

  const report = await buildStudentAnalyticsReport(supabase, schoolId, {
    studentProfileId: input.studentProfileId,
    academicYearId: input.academicYearId,
    visibleOnly: input.visibleOnly,
  });

  let snapshotId: string | undefined;
  if (input.persistSnapshot) {
    const { data: snap, error } = await supabase
      .from("student_analytics_snapshots")
      .insert({
        school_id: schoolId,
        student_profile_id: input.studentProfileId,
        academic_year_id: input.academicYearId,
        generator_version: report.generatorVersion,
        generated_at: report.generatedAt,
        aggregates: report.aggregates,
        insights: report.insights,
        progress_graphs: report.progressGraphs,
        source_counts: report.sourceCounts,
        created_by: actorId,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    snapshotId = snap?.id;
    await writeAnalyticsAudit(supabase, {
      schoolId,
      action: "analytics.snapshot_created",
      actorId,
      studentProfileId: input.studentProfileId,
      academicYearId: input.academicYearId,
      snapshotId,
      metadata: { sourceCounts: report.sourceCounts },
    });
  } else {
    await writeAnalyticsAudit(supabase, {
      schoolId,
      action: "analytics.generated",
      actorId,
      studentProfileId: input.studentProfileId,
      academicYearId: input.academicYearId,
      metadata: { sourceCounts: report.sourceCounts, persisted: false },
    });
  }

  revalidate();
  return {
    success: true,
    message: snapshotId
      ? "Analytics generated and snapshot saved."
      : "Analytics generated.",
    id: snapshotId,
    report,
  };
}

export async function getLatestStudentAnalyticsSnapshotAction(input: {
  studentProfileId: string;
  academicYearId: string;
}): Promise<StudentAnalyticsActionResult> {
  const context = await getAuthenticatedSchoolContext("analytics.dashboard.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateGenerateInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { data, error } = await context.supabase
    .from("student_analytics_snapshots")
    .select(
      "id, generator_version, generated_at, aggregates, insights, progress_graphs, source_counts, student_profile_id, academic_year_id",
    )
    .eq("school_id", context.schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .eq("academic_year_id", input.academicYearId)
    .is("archived_at", null)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: "No snapshot found — generate first." };
  }

  return {
    success: true,
    message: "Latest snapshot loaded.",
    id: data.id as string,
    report: {
      studentProfileId: data.student_profile_id as string,
      academicYearId: data.academic_year_id as string,
      generatedAt: data.generated_at as string,
      generatorVersion: data.generator_version as string,
      aggregates: data.aggregates as never,
      insights: data.insights as never,
      progressGraphs: data.progress_graphs as never,
      sourceCounts: (data.source_counts as Record<string, number>) ?? {},
    },
  };
}

export async function listStudentAnalyticsSnapshotsAction(input: {
  studentProfileId: string;
  academicYearId: string;
  limit?: number;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("analytics.dashboard.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { data, error } = await context.supabase
    .from("student_analytics_snapshots")
    .select(
      "id, generator_version, generated_at, source_counts, created_at",
    )
    .eq("school_id", context.schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .eq("academic_year_id", input.academicYearId)
    .is("archived_at", null)
    .order("generated_at", { ascending: false })
    .limit(input.limit ?? 20);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function listStudentRiskIndicatorsAction(input: {
  academicYearId: string;
  limit?: number;
}): Promise<
  | {
      success: true;
      rows: Array<{
        studentProfileId: string;
        snapshotId: string;
        generatedAt: string;
        risks: unknown[];
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("analytics.dashboard.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { data, error } = await context.supabase
    .from("student_analytics_snapshots")
    .select(
      "id, student_profile_id, generated_at, insights",
    )
    .eq("school_id", context.schoolId)
    .eq("academic_year_id", input.academicYearId)
    .is("archived_at", null)
    .order("generated_at", { ascending: false })
    .limit(input.limit ?? 200);

  if (error) {
    return { success: false, error: error.message };
  }

  // Keep latest snapshot per student
  const latest = new Map<string, (typeof data)[number]>();
  for (const row of data ?? []) {
    const sid = row.student_profile_id as string;
    if (!latest.has(sid)) latest.set(sid, row);
  }

  const rows = [...latest.values()]
    .map((row) => {
      const insights = row.insights as { risks?: unknown[] } | null;
      const risks = insights?.risks ?? [];
      return {
        studentProfileId: row.student_profile_id as string,
        snapshotId: row.id as string,
        generatedAt: row.generated_at as string,
        risks,
      };
    })
    .filter((r) => Array.isArray(r.risks) && r.risks.length > 0);

  return { success: true, rows };
}
