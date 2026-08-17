import { cache } from "react";
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

async function resolveActorUncached(options?: {
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

  // Parallel: memberships, active context, person, profile
  const [memberships, activeCtxRes, personRes, profileRes] = await Promise.all([
    listMembershipsForUser(supabase, authUserId),
    supabase
      .from("user_active_context")
      .select("school_id, persona")
      .eq("auth_user_id", authUserId)
      .maybeSingle(),
    supabase
      .from("persons")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("school_id, role")
      .eq("id", authUserId)
      .maybeSingle(),
  ]);

  const activeCtx = activeCtxRes.data;
  const personId = personRes.data?.id ?? null;
  const profile = profileRes.data;

  let preferenceSchoolId: string | null = null;
  if (personId) {
    const { data: prefs } = await supabase
      .from("user_school_preferences")
      .select("active_school_id, default_school_id")
      .eq("person_id", personId)
      .maybeSingle();
    preferenceSchoolId =
      prefs?.active_school_id ?? prefs?.default_school_id ?? null;
  }

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

  const permissionKeys = new Set<PermissionKey>();
  for (const role of systemRoles) {
    for (const key of SYSTEM_ROLE_BUNDLES[role]) {
      permissionKeys.add(key);
    }
  }

  let employmentStatus: string | null = null;
  const departmentIds: string[] = [];
  const subjectIds: string[] = [];
  const linkedStudentProfileIds: string[] = [];

  if (personId) {
    const [grantsRes, platformOpRes, tpRes, ppRes] = await Promise.all([
      supabase
        .from("authz_member_role_grants")
        .select("role_id, expires_at")
        .eq("person_id", personId)
        .eq("school_id", schoolId)
        .is("revoked_at", null),
      supabase
        .from("platform_operators")
        .select("can_impersonate")
        .eq("person_id", personId)
        .is("archived_at", null)
        .maybeSingle(),
      supabase
        .from("teacher_profiles")
        .select("id")
        .eq("person_id", personId)
        .maybeSingle(),
      supabase
        .from("parent_profiles")
        .select("id")
        .eq("person_id", personId)
        .maybeSingle(),
    ]);

    const now = Date.now();
    const roleIds = [
      ...new Set(
        (grantsRes.data ?? [])
          .filter(
            (grant) =>
              !grant.expires_at ||
              new Date(grant.expires_at as string).getTime() >= now,
          )
          .map((grant) => grant.role_id as string),
      ),
    ];

    if (roleIds.length > 0) {
      const { data: rolePerms } = await supabase
        .from("authz_role_permissions")
        .select("permission_key")
        .in("role_id", roleIds);
      for (const rp of rolePerms ?? []) {
        permissionKeys.add(rp.permission_key as PermissionKey);
      }
    }

    if (platformOpRes.data) {
      permissionKeys.add("platform.tenant.read");
      if (platformOpRes.data.can_impersonate) {
        permissionKeys.add("platform.impersonate");
      }
    }

    if (tpRes.data) {
      const { data: emps } = await supabase
        .from("teacher_employments")
        .select("id, status, department_id")
        .eq("teacher_profile_id", tpRes.data.id)
        .eq("school_id", schoolId);

      const employmentIds: string[] = [];
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
        employmentIds.push(e.id as string);
      }

      if (employmentIds.length > 0) {
        const { data: subjects } = await supabase
          .from("employment_subjects")
          .select("subject_id")
          .in("employment_id", employmentIds);
        for (const s of subjects ?? []) {
          subjectIds.push(s.subject_id as string);
        }
      }
    }

    if (ppRes.data) {
      const { data: links } = await supabase
        .from("student_parent_links")
        .select("student_profile_id")
        .eq("parent_profile_id", ppRes.data.id);
      for (const l of links ?? []) {
        linkedStudentProfileIds.push(l.student_profile_id as string);
      }
    }
  }

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

/**
 * Per-request memoized actor resolution. Layout + page + requirePermission
 * share one DB walk instead of repeating it on every nested call.
 * Cache keys are primitives so `{ schoolId: undefined }` does not miss.
 */
export async function resolveActor(options?: {
  schoolId?: string;
  persona?: string;
}): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; actor: AuthzActor }
  | { ok: false; error: string }
> {
  return resolveActorCached(
    options?.schoolId ?? "",
    options?.persona ?? "",
  );
}

const resolveActorCached = cache(
  async (schoolId: string, persona: string) =>
    resolveActorUncached({
      schoolId: schoolId || undefined,
      persona: persona || undefined,
    }),
);
