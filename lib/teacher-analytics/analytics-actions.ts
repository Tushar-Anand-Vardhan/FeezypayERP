"use server";

import { revalidatePath } from "next/cache";
import { buildTeacherAnalyticsReport } from "@/lib/teacher-analytics/aggregate";
import { validateGenerateTeacherInput } from "@/lib/teacher-analytics/rules";
import {
  assertEmploymentOwned,
  assertYearOwned,
  getActorId,
  writeTeacherAnalyticsAudit,
} from "@/lib/teacher-analytics/server-helpers";
import type {
  GenerateTeacherAnalyticsInput,
  TeacherAnalyticsActionResult,
} from "@/lib/teacher-analytics/types";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard/teacher");
}

/**
 * Compute deterministic teacher analytics (optionally persist E22 snapshot).
 * Never writes attendance/marks/homework OLTP facts.
 */
export async function generateTeacherAnalyticsAction(
  input: GenerateTeacherAnalyticsInput,
): Promise<TeacherAnalyticsActionResult> {
  const context = await getAuthenticatedSchoolContext("analytics.dashboard.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateGenerateTeacherInput(input);
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
    !(await assertEmploymentOwned(supabase, schoolId, input.employmentId))
  ) {
    return { success: false, error: "Employment not found." };
  }

  const report = await buildTeacherAnalyticsReport(supabase, schoolId, {
    employmentId: input.employmentId,
    academicYearId: input.academicYearId,
  });

  let snapshotId: string | undefined;
  if (input.persistSnapshot) {
    const { data: snap, error } = await supabase
      .from("teacher_analytics_snapshots")
      .insert({
        school_id: schoolId,
        employment_id: input.employmentId,
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
    await writeTeacherAnalyticsAudit(supabase, {
      schoolId,
      action: "teacher_analytics.snapshot_created",
      actorId,
      employmentId: input.employmentId,
      academicYearId: input.academicYearId,
      snapshotId,
      metadata: { sourceCounts: report.sourceCounts },
    });
  } else {
    await writeTeacherAnalyticsAudit(supabase, {
      schoolId,
      action: "teacher_analytics.generated",
      actorId,
      employmentId: input.employmentId,
      academicYearId: input.academicYearId,
      metadata: { sourceCounts: report.sourceCounts, persisted: false },
    });
  }

  revalidate();
  return {
    success: true,
    message: snapshotId
      ? "Teacher analytics generated and snapshot saved."
      : "Teacher analytics generated.",
    id: snapshotId,
    report,
  };
}

export async function getLatestTeacherAnalyticsSnapshotAction(input: {
  employmentId: string;
  academicYearId: string;
}): Promise<TeacherAnalyticsActionResult> {
  const context = await getAuthenticatedSchoolContext("analytics.dashboard.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateGenerateTeacherInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { data, error } = await context.supabase
    .from("teacher_analytics_snapshots")
    .select(
      "id, generator_version, generated_at, aggregates, insights, progress_graphs, source_counts, employment_id, academic_year_id",
    )
    .eq("school_id", context.schoolId)
    .eq("employment_id", input.employmentId)
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
      employmentId: data.employment_id as string,
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

export async function listTeacherAnalyticsSnapshotsAction(input: {
  employmentId: string;
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
    .from("teacher_analytics_snapshots")
    .select("id, generator_version, generated_at, source_counts, created_at")
    .eq("school_id", context.schoolId)
    .eq("employment_id", input.employmentId)
    .eq("academic_year_id", input.academicYearId)
    .is("archived_at", null)
    .order("generated_at", { ascending: false })
    .limit(input.limit ?? 20);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function listTeacherWorkloadRisksAction(input: {
  academicYearId: string;
  limit?: number;
}): Promise<
  | {
      success: true;
      rows: Array<{
        employmentId: string;
        snapshotId: string;
        generatedAt: string;
        risks: unknown[];
        workloadScore: number | null;
      }>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("analytics.dashboard.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { data, error } = await context.supabase
    .from("teacher_analytics_snapshots")
    .select("id, employment_id, generated_at, insights, aggregates")
    .eq("school_id", context.schoolId)
    .eq("academic_year_id", input.academicYearId)
    .is("archived_at", null)
    .order("generated_at", { ascending: false })
    .limit(input.limit ?? 200);

  if (error) {
    return { success: false, error: error.message };
  }

  const latest = new Map<string, (typeof data)[number]>();
  for (const row of data ?? []) {
    const eid = row.employment_id as string;
    if (!latest.has(eid)) latest.set(eid, row);
  }

  const rows = [...latest.values()]
    .map((row) => {
      const insights = row.insights as { risks?: unknown[] } | null;
      const aggregates = row.aggregates as {
        workload?: { workloadScore?: number };
      } | null;
      const risks = insights?.risks ?? [];
      return {
        employmentId: row.employment_id as string,
        snapshotId: row.id as string,
        generatedAt: row.generated_at as string,
        risks,
        workloadScore: aggregates?.workload?.workloadScore ?? null,
      };
    })
    .filter((r) => Array.isArray(r.risks) && r.risks.length > 0);

  return { success: true, rows };
}
