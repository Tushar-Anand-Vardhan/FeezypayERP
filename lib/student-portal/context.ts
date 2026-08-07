import type { AuthzContext } from "@/lib/authz/types";
import { requirePermission } from "@/lib/authz/require";
import { assertStudentInSchool } from "@/lib/student-profile/server-helpers";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type StudentPortalContext = {
  authz: AuthzContext;
  schoolId: string;
  studentProfileId: string;
  admissionId: string;
  personId: string;
  isPreview: boolean;
  displayName: string | null;
};

export type StudentPortalContextResult =
  | { success: true; context: StudentPortalContext }
  | { success: false; error: string };

async function resolveLinkedStudentProfile(
  supabase: Supabase,
  schoolId: string,
  authUserId: string,
): Promise<{
  studentProfileId: string;
  admissionId: string;
  personId: string;
  fullName: string | null;
} | null> {
  const { data: person } = await supabase
    .from("persons")
    .select("id, full_name")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!person) return null;

  const { data: profile } = await supabase
    .from("student_profiles")
    .select("id")
    .eq("person_id", person.id)
    .maybeSingle();
  if (!profile) return null;

  const owned = await assertStudentInSchool(supabase, schoolId, profile.id);
  if (!owned) return null;

  return {
    studentProfileId: owned.studentProfileId,
    admissionId: owned.admissionId,
    personId: owned.personId,
    fullName: person.full_name,
  };
}

function canPreviewAnyStudent(authz: AuthzContext): boolean {
  if (authz.actor.isSchoolAdmin) return true;
  if (authz.actor.systemRoles.includes("principal")) return true;
  if (authz.actor.systemRoles.includes("vice_principal")) return true;
  // Pure student / parent personas must never preview arbitrary profiles.
  const persona = String(authz.actor.activePersona);
  if (persona === "student" || persona === "parent" || persona === "alumni") {
    return false;
  }
  return (
    authz.actor.permissionKeys.has("enrollment.admission.read") &&
    (authz.actor.systemRoles.includes("teacher") ||
      authz.actor.systemRoles.includes("hod") ||
      authz.actor.systemRoles.includes("school_admin"))
  );
}

/**
 * Resolve the student profile for portal pages.
 * Linked auth user preferred; `?studentProfileId=` preview for staff only.
 */
export async function resolveStudentPortalContext(input?: {
  studentProfileId?: string | null;
}): Promise<StudentPortalContextResult> {
  const authz = await requirePermission("enrollment.admission.read");
  if ("error" in authz) {
    return { success: false, error: authz.error };
  }

  const { supabase, schoolId, actor } = authz;
  const previewId = input?.studentProfileId?.trim() || null;

  const linked = actor.authUserId
    ? await resolveLinkedStudentProfile(supabase, schoolId, actor.authUserId)
    : null;

  let studentProfileId: string | null = null;
  let isPreview = false;

  if (previewId) {
    if (!canPreviewAnyStudent(authz) && linked?.studentProfileId !== previewId) {
      return {
        success: false,
        error: "Not allowed to preview this student.",
      };
    }
    studentProfileId = previewId;
    isPreview = !linked || linked.studentProfileId !== previewId;
  } else if (linked) {
    studentProfileId = linked.studentProfileId;
  }

  if (!studentProfileId) {
    // Staff with no linked student: auto-pick first directory entry for preview.
    if (canPreviewAnyStudent(authz)) {
      const { data: admissions } = await supabase
        .from("student_admissions")
        .select("student_profile_id")
        .eq("school_id", schoolId)
        .eq("status", "active")
        .order("admitted_on", { ascending: false })
        .limit(1);
      const firstId = admissions?.[0]?.student_profile_id as string | undefined;
      if (firstId) {
        studentProfileId = firstId;
        isPreview = true;
      } else {
        return {
          success: false,
          error: "No students enrolled to preview.",
        };
      }
    } else {
      return {
        success: false,
        error: "No student profile linked to this account.",
      };
    }
  }

  // Student persona may only read own profile.
  const persona = String(actor.activePersona);
  if (
    (persona === "student" || persona === "alumni") &&
    linked &&
    studentProfileId !== linked.studentProfileId
  ) {
    return { success: false, error: "Can only access your own student profile." };
  }

  const owned = await assertStudentInSchool(supabase, schoolId, studentProfileId);
  if (!owned) {
    return { success: false, error: "Student not found at this school." };
  }

  let displayName: string | null = linked?.fullName ?? null;
  if (!displayName) {
    const { data: person } = await supabase
      .from("persons")
      .select("full_name")
      .eq("id", owned.personId)
      .maybeSingle();
    displayName = person?.full_name ?? null;
  }

  return {
    success: true,
    context: {
      authz,
      schoolId,
      studentProfileId: owned.studentProfileId,
      admissionId: owned.admissionId,
      personId: owned.personId,
      isPreview,
      displayName,
    },
  };
}

export async function getActiveAcademicYearId(
  supabase: Supabase,
  schoolId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .is("archived_at", null)
    .maybeSingle();
  if (data?.id) return data.id;
  const { data: fallback } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .order("label", { ascending: false })
    .limit(1)
    .maybeSingle();
  return fallback?.id ?? null;
}
