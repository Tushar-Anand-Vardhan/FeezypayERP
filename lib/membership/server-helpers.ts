import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type {
  ActiveMembershipContext,
  MembershipKind,
  CapabilityClass,
  SchoolMembershipRow,
} from "@/lib/membership/types";
import { isDateEffective } from "@/lib/membership/validation";

function mapRow(row: Record<string, unknown>): SchoolMembershipRow {
  return {
    id: String(row.id),
    personId: String(row.person_id),
    schoolId: String(row.school_id),
    membershipKind: row.membership_kind as MembershipKind,
    status: row.status as SchoolMembershipRow["status"],
    effectiveFrom: String(row.effective_from),
    effectiveTo: row.effective_to ? String(row.effective_to) : null,
    schoolPersona: row.school_persona ? String(row.school_persona) : null,
    capabilityClass: row.capability_class as CapabilityClass,
    sourceType: row.source_type as SchoolMembershipRow["sourceType"],
    sourceId: String(row.source_id),
    authzRoleIds: Array.isArray(row.authz_role_ids)
      ? (row.authz_role_ids as string[])
      : [],
  };
}

export async function listMembershipsForPerson(
  supabase: SupabaseClient,
  personId: string,
): Promise<SchoolMembershipRow[]> {
  const { data } = await supabase
    .from("school_memberships")
    .select(
      "id, person_id, school_id, membership_kind, status, effective_from, effective_to, school_persona, capability_class, source_type, source_id, authz_role_ids",
    )
    .eq("person_id", personId)
    .is("archived_at", null)
    .order("school_id");

  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getActiveMembershipContext(
  supabase?: SupabaseClient,
): Promise<ActiveMembershipContext | null> {
  const client = supabase ?? (await createClient());
  const { data: claimsData } = await client.auth.getClaims();
  const authUserId = claimsData?.claims?.sub;
  if (typeof authUserId !== "string") {
    return null;
  }

  const { data: person } = await client
    .from("persons")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!person?.id) {
    const { data: profile } = await client
      .from("profiles")
      .select("school_id")
      .eq("id", authUserId)
      .maybeSingle();
    if (!profile?.school_id) {
      return null;
    }
    return {
      personId: "",
      authUserId,
      schoolId: profile.school_id,
      membershipId: null,
      persona: "school_admin",
      membershipKind: "school_admin",
      capabilityClass: "admin",
    };
  }

  const { data: prefs } = await client
    .from("user_school_preferences")
    .select("active_school_id, active_membership_id, default_school_id")
    .eq("person_id", person.id)
    .maybeSingle();

  const { data: ctx } = await client
    .from("user_active_context")
    .select("school_id, persona")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const memberships = await listMembershipsForPerson(client, person.id);
  const switchable = memberships.filter(
    (m) =>
      (m.status === "active" || m.status === "invited") &&
      isDateEffective(m.effectiveFrom, m.effectiveTo),
  );

  let membership =
    (prefs?.active_membership_id
      ? switchable.find((m) => m.id === prefs.active_membership_id)
      : null) ??
    (prefs?.active_school_id
      ? switchable.find((m) => m.schoolId === prefs.active_school_id)
      : null) ??
    (ctx?.school_id
      ? switchable.find((m) => m.schoolId === ctx.school_id)
      : null) ??
    (prefs?.default_school_id
      ? switchable.find((m) => m.schoolId === prefs.default_school_id)
      : null) ??
    switchable.find((m) => m.membershipKind === "school_admin") ??
    switchable[0] ??
    null;

  if (!membership) {
    return null;
  }

  return {
    personId: person.id,
    authUserId,
    schoolId: membership.schoolId,
    membershipId: membership.id,
    persona:
      membership.schoolPersona ??
      ctx?.persona ??
      membership.membershipKind,
    membershipKind: membership.membershipKind,
    capabilityClass: membership.capabilityClass,
  };
}
