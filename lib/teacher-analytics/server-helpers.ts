import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function assertYearOwned(
  supabase: Supabase,
  schoolId: string,
  yearId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", yearId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
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

export async function writeTeacherAnalyticsAudit(
  supabase: Supabase,
  input: {
    schoolId: string;
    action: string;
    actorId?: string | null;
    employmentId?: string | null;
    academicYearId?: string | null;
    snapshotId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  await supabase.from("teacher_analytics_audit_log").insert({
    school_id: input.schoolId,
    action: input.action,
    actor_id: input.actorId ?? null,
    employment_id: input.employmentId ?? null,
    academic_year_id: input.academicYearId ?? null,
    snapshot_id: input.snapshotId ?? null,
    metadata: input.metadata ?? null,
  });
}
