import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function writeReportCardAudit(
  supabase: Supabase,
  input: {
    schoolId: string;
    action: string;
    actorId?: string | null;
    issueId?: string | null;
    issueVersionId?: string | null;
    studentProfileId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  },
): Promise<void> {
  await supabase.from("report_card_audit_log").insert({
    school_id: input.schoolId,
    action: input.action,
    actor_id: input.actorId ?? null,
    issue_id: input.issueId ?? null,
    issue_version_id: input.issueVersionId ?? null,
    student_profile_id: input.studentProfileId ?? null,
    old_values: input.oldValues ?? null,
    new_values: input.newValues ?? null,
  });
}

export async function assertStudentInSchool(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("student_admissions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .maybeSingle();
  return Boolean(data);
}

export async function loadIssue(
  supabase: Supabase,
  schoolId: string,
  issueId: string,
) {
  const { data } = await supabase
    .from("report_card_issues")
    .select("*")
    .eq("id", issueId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return data;
}

export async function loadCurrentVersion(
  supabase: Supabase,
  schoolId: string,
  issue: { id: string; current_version_id: string | null },
) {
  if (!issue.current_version_id) return null;
  const { data } = await supabase
    .from("report_card_issue_versions")
    .select("*")
    .eq("id", issue.current_version_id)
    .eq("school_id", schoolId)
    .maybeSingle();
  return data;
}

export async function nextVersionNumber(
  supabase: Supabase,
  issueId: string,
): Promise<number> {
  const { data } = await supabase
    .from("report_card_issue_versions")
    .select("version")
    .eq("issue_id", issueId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version ?? 0) + 1;
}
