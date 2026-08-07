import type {
  createClient,
} from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function assertDepartmentOwned(
  supabase: Supabase,
  schoolId: string,
  departmentId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("departments")
    .select("id")
    .eq("id", departmentId)
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

export async function assertSubjectOwned(
  supabase: Supabase,
  schoolId: string,
  subjectId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function appendDepartmentHistory(
  supabase: Supabase,
  input: {
    departmentId: string;
    action: string;
    summary?: string;
    changes?: Record<string, unknown>;
    actorId?: string | null;
  },
): Promise<void> {
  await supabase.from("department_history").insert({
    department_id: input.departmentId,
    action: input.action,
    summary: input.summary ?? null,
    changes: input.changes ?? {},
    actor_id: input.actorId ?? null,
  });
}

/** Keep employment.department_id / is_hod in sync for onboarding compatibility. */
export async function syncEmploymentDepartmentFlags(
  supabase: Supabase,
  schoolId: string,
  employmentId: string,
): Promise<void> {
  const { data: memberships } = await supabase
    .from("department_memberships")
    .select("department_id, role")
    .eq("employment_id", employmentId)
    .is("left_on", null);

  const head = (memberships ?? []).find((m) => m.role === "head");
  const any = memberships?.[0];

  await supabase
    .from("teacher_employments")
    .update({
      department_id: head?.department_id ?? any?.department_id ?? null,
      is_hod: Boolean(head),
      updated_at: new Date().toISOString(),
    })
    .eq("id", employmentId)
    .eq("school_id", schoolId);
}
