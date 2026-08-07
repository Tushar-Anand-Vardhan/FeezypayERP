import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthMembership, AuthPersona } from "@/lib/auth/types";

type MembershipRow = {
  school_id: string;
  persona: string;
  source: string;
  source_id: string;
  status: string;
};

export async function listMembershipsForUser(
  supabase: SupabaseClient,
  authUserId?: string,
): Promise<AuthMembership[]> {
  const { data, error } = authUserId
    ? await supabase.rpc("list_auth_memberships", { p_uid: authUserId })
    : await supabase.rpc("list_auth_memberships");

  if (error || !data) {
    return [];
  }

  return (data as MembershipRow[]).map((row) => ({
    schoolId: row.school_id,
    persona: row.persona as AuthPersona,
    source: row.source as AuthMembership["source"],
    sourceId: row.source_id,
    status: row.status,
  }));
}

export async function listMembershipSchoolIds(
  supabase: SupabaseClient,
  authUserId?: string,
): Promise<string[]> {
  const { data, error } = authUserId
    ? await supabase.rpc("membership_schools", { p_uid: authUserId })
    : await supabase.rpc("membership_schools");

  if (error || !data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data
      .map((row) =>
        typeof row === "string"
          ? row
          : typeof row === "object" && row && "membership_schools" in row
            ? String((row as { membership_schools: string }).membership_schools)
            : String(row),
      )
      .filter(Boolean);
  }

  return [];
}

export function pickDefaultMembership(
  memberships: AuthMembership[],
): AuthMembership | null {
  const active = memberships.filter((m) =>
    ["active", "invited"].includes(m.status),
  );
  const pool = active.length > 0 ? active : memberships;
  if (pool.length === 0) {
    return null;
  }

  const admin = pool.find((m) => m.persona === "school_admin");
  if (admin) {
    return admin;
  }

  return pool[0] ?? null;
}

export function isLoginCapableMembership(m: AuthMembership): boolean {
  if (m.source === "employment") {
    return m.status === "active" || m.status === "invited";
  }
  if (m.source === "admission") {
    return m.status === "active" || m.status === "alumni";
  }
  if (m.source === "parent_link") {
    return true;
  }
  return m.source === "profile";
}
