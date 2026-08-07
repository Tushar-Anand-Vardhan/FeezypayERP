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

export async function writeAnalyticsAudit(
  supabase: Supabase,
  input: {
    schoolId: string;
    action: string;
    actorId?: string | null;
    studentProfileId?: string | null;
    academicYearId?: string | null;
    snapshotId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  await supabase.from("student_analytics_audit_log").insert({
    school_id: input.schoolId,
    action: input.action,
    actor_id: input.actorId ?? null,
    student_profile_id: input.studentProfileId ?? null,
    academic_year_id: input.academicYearId ?? null,
    snapshot_id: input.snapshotId ?? null,
    metadata: input.metadata ?? null,
  });
}
