/** Department Engine (E05 surface) types. */

export type DepartmentActionResult =
  | { success: true; message: string; id?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type DepartmentMembershipRole = "head" | "coordinator" | "member";

export type DepartmentAnnouncementVisibility =
  | "department"
  | "staff"
  | "school";

export type DepartmentAnnouncementStatus = "draft" | "published" | "retracted";

export type DepartmentResourceType = "link" | "file" | "note" | "other";

export type DepartmentInput = {
  id?: string;
  name: string;
  code?: string;
  description?: string;
  parentDepartmentId?: string | null;
  costCenterCode?: string | null;
};

export type MembershipInput = {
  departmentId: string;
  employmentId: string;
  role: DepartmentMembershipRole;
  joinedOn?: string;
  notes?: string;
};

export type DepartmentSubjectInput = {
  departmentId: string;
  subjectId: string;
  isPrimary?: boolean;
};

export type TeachingAssignmentInput = {
  departmentId: string;
  employmentId: string;
  subjectId: string;
  academicYearId?: string | null;
  startedOn?: string;
  notes?: string;
};

export type AnnouncementInput = {
  id?: string;
  departmentId: string;
  title: string;
  body?: string;
  visibility?: DepartmentAnnouncementVisibility;
  status?: DepartmentAnnouncementStatus;
  notifyOnPublish?: boolean;
};

export type ResourceInput = {
  id?: string;
  departmentId: string;
  title: string;
  description?: string;
  resourceType?: DepartmentResourceType;
  url?: string;
  mediaId?: string | null;
};

export const DEPARTMENT_MEMBERSHIP_ROLES: DepartmentMembershipRole[] = [
  "head",
  "coordinator",
  "member",
];

export const DEPARTMENT_MEMBERSHIP_ROLE_LABELS: Record<
  DepartmentMembershipRole,
  string
> = {
  head: "Department head",
  coordinator: "Coordinator",
  member: "Member",
};
