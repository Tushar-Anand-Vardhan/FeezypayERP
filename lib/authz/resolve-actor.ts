import { createClient } from "@/lib/supabase/server";
import {
  listMembershipsForUser,
  pickDefaultMembership,
} from "@/lib/auth/membership";
import type { AuthPersona } from "@/lib/auth/types";
import {
  SYSTEM_ROLE_BUNDLES,
  type SystemRoleCode,
  SYSTEM_ROLE_CODES,
} from "@/lib/authz/bundles";
import type { PermissionKey } from "@/lib/authz/catalog";
import type { AuthzActor } from "@/lib/authz/types";

function asSystemRole(persona: string): SystemRoleCode | null {
  if ((SYSTEM_ROLE_CODES as readonly string[]).includes(persona)) {
    return persona as SystemRoleCode;
  }
  if (persona === "alumni") {
    return "student";
  }
  return null;
}

export async function resolveActor(options?: {
  schoolId?: string;
  persona?: string;
}): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; actor: AuthzActor }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const authUserId = claimsData?.claims?.sub;
  if (typeof authUserId !== "string") {
    return { ok: false, error: "You must be signed in." };
  }

  const memberships = await listMembershipsForUser(supabase, authUserId);

  const { data: activeCtx } = await supabase
    .from("user_active_context")
    .select("school_id, persona")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const preferredSchoolMembership =
    options?.schoolId != null
      ? memberships.find((m) => m.schoolId === options.schoolId)
      : null;

  const activeSchoolMembership =
    activeCtx?.school_id != null
      ? memberships.find((m) => m.schoolId === activeCtx.school_id)
      : null;

  const preferred =
    preferredSchoolMembership ??
    activeSchoolMembership ??
    pickDefaultMembership(memberships);

  // Prefer E29 preferences when present
  const { data: personRow } = await supabase
    .from("persons")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  let preferenceSchoolId: string | null = null;
  if (personRow?.id) {
    const { data: prefs } = await supabase
      .from("user_school_preferences")
      .select("active_school_id, default_school_id")
      .eq("person_id", personRow.id)
      .maybeSingle();
    preferenceSchoolId =
      prefs?.active_school_id ?? prefs?.default_school_id ?? null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id, role")
    .eq("id", authUserId)
    .maybeSingle();

  const schoolId =
    options?.schoolId ??
    preferenceSchoolId ??
    preferred?.schoolId ??
    activeCtx?.school_id ??
    profile?.school_id ??
    null;

  if (!schoolId) {
    return { ok: false, error: "We could not find your school membership." };
  }

  const schoolMemberships = memberships.filter((m) => m.schoolId === schoolId);
  const isSchoolAdmin =
    profile?.role === "school_admin" && profile.school_id === schoolId;

  const activePersona: AuthPersona | string =
    options?.persona ??
    (activeCtx && activeCtx.school_id === schoolId
      ? activeCtx.persona
      : null) ??
    preferred?.persona ??
    (isSchoolAdmin ? "school_admin" : "teacher");

  const systemRoles = new Set<SystemRoleCode>();
  if (isSchoolAdmin) {
    systemRoles.add("school_admin");
  }
  for (const m of schoolMemberships) {
    const role = asSystemRole(m.persona);
    if (role) {
      systemRoles.add(role);
    }
  }
  const activeRole = asSystemRole(String(activePersona));
  if (activeRole) {
    systemRoles.add(activeRole);
  }

  const { data: person } = await supabase
    .from("persons")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const personId = person?.id ?? null;

  // Custom role grants
  const permissionKeys = new Set<PermissionKey>();
  for (const role of systemRoles) {
    for (const key of SYSTEM_ROLE_BUNDLES[role]) {
      permissionKeys.add(key);
    }
  }

  if (personId) {
    const { data: grants } = await supabase
      .from("authz_member_role_grants")
      .select("role_id, expires_at, authz_roles(code, is_system)")
      .eq("person_id", personId)
      .eq("school_id", schoolId)
      .is("revoked_at", null);

    for (const grant of grants ?? []) {
      if (
        grant.expires_at &&
        new Date(grant.expires_at as string) < new Date()
      ) {
        continue;
      }
      const { data: rolePerms } = await supabase
        .from("authz_role_permissions")
        .select("permission_key")
        .eq("role_id", grant.role_id);
      for (const rp of rolePerms ?? []) {
        permissionKeys.add(rp.permission_key as PermissionKey);
      }
    }

    // Wave 6: platform operators get cross-tenant keys outside school bundles
    const { data: platformOp } = await supabase
      .from("platform_operators")
      .select("can_impersonate")
      .eq("person_id", personId)
      .is("archived_at", null)
      .maybeSingle();
    if (platformOp) {
      permissionKeys.add("platform.tenant.read");
      if (platformOp.can_impersonate) {
        permissionKeys.add("platform.impersonate");
      }
    }
  }

  // Invited staff: strip to identity self-edit until active
  let employmentStatus: string | null = null;
  const departmentIds: string[] = [];
  const subjectIds: string[] = [];
  const linkedStudentProfileIds: string[] = [];

  if (personId) {
    const { data: tp } = await supabase
      .from("teacher_profiles")
      .select("id")
      .eq("person_id", personId)
      .maybeSingle();

    if (tp) {
      const { data: emps } = await supabase
        .from("teacher_employments")
        .select("id, status, department_id, is_hod")
        .eq("teacher_profile_id", tp.id)
        .eq("school_id", schoolId);

      for (const e of emps ?? []) {
        employmentStatus = e.status as string;
        if (e.department_id) {
          departmentIds.push(e.department_id as string);
        }
        if (e.status === "invited") {
          permissionKeys.clear();
          permissionKeys.add("tenant.school.read");
          permissionKeys.add("access.session.read");
          permissionKeys.add("identity.person.read");
          permissionKeys.add("identity.person.edit");
        }
        const { data: subjects } = await supabase
          .from("employment_subjects")
          .select("subject_id")
          .eq("employment_id", e.id);
        for (const s of subjects ?? []) {
          subjectIds.push(s.subject_id as string);
        }
      }
    }

    const { data: pp } = await supabase
      .from("parent_profiles")
      .select("id")
      .eq("person_id", personId)
      .maybeSingle();
    if (pp) {
      const { data: links } = await supabase
        .from("student_parent_links")
        .select("student_profile_id")
        .eq("parent_profile_id", pp.id);
      for (const l of links ?? []) {
        linkedStudentProfileIds.push(l.student_profile_id as string);
      }
    }
  }

  // Ensure school_admin always has full bundle even if memberships empty of persona
  if (isSchoolAdmin) {
    for (const key of SYSTEM_ROLE_BUNDLES.school_admin) {
      permissionKeys.add(key);
    }
  }

  return {
    ok: true,
    supabase,
    actor: {
      authUserId,
      personId,
      schoolId,
      activePersona,
      systemRoles: [...systemRoles],
      permissionKeys,
      departmentIds: [...new Set(departmentIds)],
      subjectIds: [...new Set(subjectIds)],
      linkedStudentProfileIds: [...new Set(linkedStudentProfileIds)],
      employmentStatus,
      isSchoolAdmin,
    },
  };
}
