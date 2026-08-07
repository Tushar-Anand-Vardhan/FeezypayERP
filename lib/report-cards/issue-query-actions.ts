"use server";

import { assertYearOwned } from "@/lib/report-cards/server-helpers";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listReportCardIssuesAction(input: {
  academicYearId?: string;
  studentProfileId?: string;
  status?: string;
  /** When set, overrides single status filter (e.g. published + issued + locked). */
  statuses?: string[];
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("document.report_card.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("report_card_issues")
    .select(
      "id, student_profile_id, academic_year_id, term_id, template_id, current_version_id, status, title, issued_at, locked_at, created_at, updated_at",
    )
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (input.academicYearId) {
    if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
      return { success: false, error: "Academic year not found." };
    }
    query = query.eq("academic_year_id", input.academicYearId);
  }
  if (input.studentProfileId) {
    query = query.eq("student_profile_id", input.studentProfileId);
  }
  if (input.statuses?.length) {
    query = query.in("status", input.statuses);
  } else if (input.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function getReportCardIssueAction(issueId: string): Promise<
  | {
      success: true;
      issue: Record<string, unknown>;
      currentVersion: Record<string, unknown> | null;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("document.report_card.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: issue } = await supabase
    .from("report_card_issues")
    .select("*")
    .eq("id", issueId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!issue) {
    return { success: false, error: "Report card issue not found." };
  }

  let currentVersion: Record<string, unknown> | null = null;
  if (issue.current_version_id) {
    const { data: version } = await supabase
      .from("report_card_issue_versions")
      .select("*")
      .eq("id", issue.current_version_id)
      .maybeSingle();
    currentVersion = version;
  }

  return { success: true, issue, currentVersion };
}

export async function listReportCardVersionsAction(issueId: string): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("document.report_card.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: issue } = await supabase
    .from("report_card_issues")
    .select("id")
    .eq("id", issueId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!issue) {
    return { success: false, error: "Report card issue not found." };
  }

  const { data, error } = await supabase
    .from("report_card_issue_versions")
    .select(
      "id, version, status, template_version_id, teacher_remarks, principal_remarks, promotion_status, generated_at, issued_at, superseded_at, notes, created_at",
    )
    .eq("issue_id", issueId)
    .order("version", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function getReportCardVersionAction(versionId: string): Promise<
  | { success: true; version: Record<string, unknown> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("document.report_card.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data, error } = await supabase
    .from("report_card_issue_versions")
    .select("*")
    .eq("id", versionId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Version not found." };
  }
  return { success: true, version: data };
}

export async function listReportCardAuditAction(input: {
  issueId?: string;
  studentProfileId?: string;
  limit?: number;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("document.report_card.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("report_card_audit_log")
    .select(
      "id, action, actor_id, issue_id, issue_version_id, student_profile_id, old_values, new_values, created_at",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);

  if (input.issueId) {
    query = query.eq("issue_id", input.issueId);
  }
  if (input.studentProfileId) {
    query = query.eq("student_profile_id", input.studentProfileId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

/**
 * Preview assembly without persisting — useful for readiness checks.
 * Still reads live sources; never writes marks.
 */
export async function previewReportCardAssemblyAction(input: {
  studentProfileId: string;
  academicYearId: string;
  templateId: string;
  termId?: string | null;
}): Promise<
  | {
      success: true;
      sourceRefs: Record<string, unknown>;
      presentation: Record<string, unknown>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("document.report_card.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { assembleReportCardFromSources } = await import(
    "@/lib/report-cards/assemble"
  );
  const assembled = await assembleReportCardFromSources(context.supabase, {
    schoolId: context.schoolId,
    studentProfileId: input.studentProfileId,
    academicYearId: input.academicYearId,
    templateId: input.templateId,
    termId: input.termId,
  });

  if ("error" in assembled) {
    return { success: false, error: assembled.error };
  }

  return {
    success: true,
    sourceRefs: assembled.sourceRefs,
    presentation: assembled.presentation,
  };
}
