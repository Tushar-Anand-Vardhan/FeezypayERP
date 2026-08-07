"use server";

import { assertYearOwned } from "@/lib/behaviour/server-helpers";
import type { BehaviourAnalyticsQuery } from "@/lib/behaviour/types";
import { validateAnalyticsQuery } from "@/lib/behaviour/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listBehaviourRemarksAction(input: {
  academicYearId: string;
  studentProfileId?: string;
  remarkKind?: string;
  visibility?: string;
  sectionId?: string;
  classId?: string;
  /** Parent/student portal: only parent_visible / school */
  visibleOnly?: boolean;
  includeArchived?: boolean;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("conduct.incident.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  let query = supabase
    .from("conduct_incidents")
    .select(
      "id, student_profile_id, academic_year_id, remark_kind, visibility, title, body, description, category, severity, status, occurred_on, recorded_at, follow_up_required, follow_up_status, visible_to_guardians, visible_to_students, recorded_by, recorded_by_employment_id, class_id, section_id, created_at, updated_at",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .is("superseded_at", null)
    .order("recorded_at", { ascending: false })
    .limit(1000);

  if (!input.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (input.studentProfileId) {
    query = query.eq("student_profile_id", input.studentProfileId);
  }
  if (input.remarkKind) {
    query = query.eq("remark_kind", input.remarkKind);
  }
  if (input.visibility) {
    query = query.eq("visibility", input.visibility);
  }
  if (input.sectionId) {
    query = query.eq("section_id", input.sectionId);
  }
  if (input.classId) {
    query = query.eq("class_id", input.classId);
  }
  if (input.visibleOnly) {
    query = query.or(
      "visible_to_guardians.eq.true,visible_to_students.eq.true",
    );
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, rows: data ?? [] };
}

export async function getBehaviourRemarkAction(remarkId: string): Promise<
  | {
      success: true;
      remark: Record<string, unknown>;
      followUps: Array<Record<string, unknown>>;
    }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("conduct.incident.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const { data: remark } = await supabase
    .from("conduct_incidents")
    .select("*")
    .eq("id", remarkId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .is("superseded_at", null)
    .maybeSingle();

  if (!remark) {
    return { success: false, error: "Remark not found." };
  }

  const { data: followUps } = await supabase
    .from("behaviour_follow_ups")
    .select(
      "id, action_type, title, description, due_on, completed_at, status, assigned_to_employment_id, recorded_at, created_at",
    )
    .eq("conduct_incident_id", remarkId)
    .is("archived_at", null)
    .order("recorded_at", { ascending: true });

  return {
    success: true,
    remark,
    followUps: followUps ?? [],
  };
}

export async function listBehaviourFollowUpsAction(input: {
  academicYearId?: string;
  conductIncidentId?: string;
  status?: string;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("conduct.incident.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("behaviour_follow_ups")
    .select(
      "id, conduct_incident_id, action_type, title, description, due_on, completed_at, status, assigned_to_employment_id, recorded_at",
    )
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .order("recorded_at", { ascending: false })
    .limit(500);

  if (input.conductIncidentId) {
    query = query.eq("conduct_incident_id", input.conductIncidentId);
  }
  if (input.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  let rows = data ?? [];
  if (input.academicYearId) {
    const incidentIds = [
      ...new Set(rows.map((r) => r.conduct_incident_id as string)),
    ];
    if (!incidentIds.length) {
      return { success: true, rows: [] };
    }
    const { data: incidents } = await supabase
      .from("conduct_incidents")
      .select("id")
      .in("id", incidentIds)
      .eq("academic_year_id", input.academicYearId);
    const allowed = new Set((incidents ?? []).map((i) => i.id));
    rows = rows.filter((r) => allowed.has(r.conduct_incident_id as string));
  }

  return { success: true, rows };
}

/**
 * Derived analytics for future dashboards — not a second SoT.
 */
export async function getBehaviourAnalyticsAction(
  input: BehaviourAnalyticsQuery,
): Promise<
  | {
      success: true;
      analytics: {
        total: number;
        byKind: Record<string, number>;
        bySeverity: Record<string, number>;
        byVisibility: Record<string, number>;
        byStatus: Record<string, number>;
        followUpsPending: number;
        positiveShare: number | null;
      };
    }
  | { success: false; error: string; fieldErrors?: Record<string, string> }
> {
  const context = await getAuthenticatedSchoolContext("conduct.incident.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateAnalyticsQuery(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }

  let query = supabase
    .from("conduct_incidents")
    .select(
      "remark_kind, severity, visibility, status, follow_up_status, student_profile_id",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .is("archived_at", null)
    .is("superseded_at", null)
    .limit(5000);

  if (input.studentProfileId) {
    query = query.eq("student_profile_id", input.studentProfileId);
  }
  if (input.sectionId) {
    query = query.eq("section_id", input.sectionId);
  }
  if (input.classId) {
    query = query.eq("class_id", input.classId);
  }
  if (input.remarkKind) {
    query = query.eq("remark_kind", input.remarkKind);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  const rows = data ?? [];
  const byKind: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byVisibility: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let followUpsPending = 0;
  let positive = 0;

  for (const r of rows) {
    const kind = (r.remark_kind as string) ?? "other";
    byKind[kind] = (byKind[kind] ?? 0) + 1;
    const sev = (r.severity as string) ?? "low";
    bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;
    const vis = (r.visibility as string) ?? "staff";
    byVisibility[vis] = (byVisibility[vis] ?? 0) + 1;
    const st = (r.status as string) ?? "open";
    byStatus[st] = (byStatus[st] ?? 0) + 1;
    if (
      r.follow_up_status === "pending" ||
      r.follow_up_status === "in_progress"
    ) {
      followUpsPending += 1;
    }
    if (kind === "positive" || kind === "commendation") {
      positive += 1;
    }
  }

  return {
    success: true,
    analytics: {
      total: rows.length,
      byKind,
      bySeverity,
      byVisibility,
      byStatus,
      followUpsPending,
      positiveShare: rows.length
        ? Math.round((positive / rows.length) * 10000) / 100
        : null,
    },
  };
}

export async function listBehaviourAuditAction(input: {
  academicYearId?: string;
  studentProfileId?: string;
  conductIncidentId?: string;
  limit?: number;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("conduct.incident.read");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  let query = supabase
    .from("behaviour_audit_log")
    .select(
      "id, action, actor_id, conduct_incident_id, follow_up_id, student_profile_id, old_values, new_values, created_at",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);

  if (input.studentProfileId) {
    query = query.eq("student_profile_id", input.studentProfileId);
  }
  if (input.conductIncidentId) {
    query = query.eq("conduct_incident_id", input.conductIncidentId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  // Optional year filter via incident join
  let rows = data ?? [];
  if (input.academicYearId && rows.length) {
    const ids = [
      ...new Set(
        rows
          .map((r) => r.conduct_incident_id as string | null)
          .filter(Boolean) as string[],
      ),
    ];
    if (ids.length) {
      const { data: incidents } = await supabase
        .from("conduct_incidents")
        .select("id")
        .in("id", ids)
        .eq("academic_year_id", input.academicYearId);
      const allowed = new Set((incidents ?? []).map((i) => i.id));
      rows = rows.filter(
        (r) =>
          !r.conduct_incident_id ||
          allowed.has(r.conduct_incident_id as string),
      );
    }
  }

  return { success: true, rows };
}
