import type { PermissionKey } from "@/lib/authz/catalog";
import type { SystemRoleCode } from "@/lib/authz/bundles";
import type { AuthPersona } from "@/lib/auth/types";

export type AuthzAttrs = {
  schoolId?: string;
  departmentId?: string | null;
  subjectId?: string | null;
  sectionId?: string | null;
  admissionId?: string | null;
  studentProfileId?: string | null;
  personId?: string | null;
  employmentId?: string | null;
  resourcePersonId?: string | null;
  yearClosed?: boolean;
};

export type AuthzActor = {
  authUserId: string;
  personId: string | null;
  schoolId: string;
  activePersona: AuthPersona | SystemRoleCode | string;
  systemRoles: SystemRoleCode[];
  permissionKeys: Set<PermissionKey>;
  departmentIds: string[];
  subjectIds: string[];
  linkedStudentProfileIds: string[];
  employmentStatus: string | null;
  isSchoolAdmin: boolean;
};

export type AuthzDecision =
  | { allow: true }
  | { allow: false; reason: string };

export type AuthzContext = {
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >;
  schoolId: string;
  actor: AuthzActor;
};
