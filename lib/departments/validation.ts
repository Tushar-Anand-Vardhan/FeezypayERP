import {
  DEPARTMENT_MEMBERSHIP_ROLES,
  type AnnouncementInput,
  type DepartmentInput,
  type DepartmentSubjectInput,
  type MembershipInput,
  type ResourceInput,
  type TeachingAssignmentInput,
} from "@/lib/departments/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) {
    return false;
  }
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export function trimDepartmentInput(input: DepartmentInput): DepartmentInput {
  return {
    id: input.id,
    name: input.name.trim(),
    code: input.code?.trim() ?? "",
    description: input.description?.trim() ?? "",
    parentDepartmentId: input.parentDepartmentId?.trim() || null,
    costCenterCode: input.costCenterCode?.trim() || null,
  };
}

export function validateDepartmentInput(
  input: DepartmentInput,
): Record<string, string> {
  const trimmed = trimDepartmentInput(input);
  const errors: Record<string, string> = {};
  if (!trimmed.name) {
    errors.name = "Department name is required.";
  }
  if (trimmed.name.length > 120) {
    errors.name = "Name must be 120 characters or fewer.";
  }
  return errors;
}

export function trimMembershipInput(input: MembershipInput): MembershipInput {
  return {
    departmentId: input.departmentId.trim(),
    employmentId: input.employmentId.trim(),
    role: input.role,
    joinedOn: input.joinedOn?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  };
}

export function validateMembershipInput(
  input: MembershipInput,
): Record<string, string> {
  const trimmed = trimMembershipInput(input);
  const errors: Record<string, string> = {};
  if (!trimmed.departmentId) {
    errors.departmentId = "Department is required.";
  }
  if (!trimmed.employmentId) {
    errors.employmentId = "Employment is required.";
  }
  if (!DEPARTMENT_MEMBERSHIP_ROLES.includes(trimmed.role)) {
    errors.role = "Role must be head, coordinator, or member.";
  }
  if (trimmed.joinedOn && !isIsoDate(trimmed.joinedOn)) {
    errors.joinedOn = "Joined on must be YYYY-MM-DD.";
  }
  return errors;
}

export function validateDepartmentSubjectInput(
  input: DepartmentSubjectInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.departmentId?.trim()) {
    errors.departmentId = "Department is required.";
  }
  if (!input.subjectId?.trim()) {
    errors.subjectId = "Subject is required.";
  }
  return errors;
}

export function validateTeachingAssignmentInput(
  input: TeachingAssignmentInput,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.departmentId?.trim()) {
    errors.departmentId = "Department is required.";
  }
  if (!input.employmentId?.trim()) {
    errors.employmentId = "Employment is required.";
  }
  if (!input.subjectId?.trim()) {
    errors.subjectId = "Subject is required.";
  }
  if (input.startedOn && !isIsoDate(input.startedOn.trim())) {
    errors.startedOn = "Started on must be YYYY-MM-DD.";
  }
  return errors;
}

export function trimAnnouncementInput(
  input: AnnouncementInput,
): AnnouncementInput {
  return {
    ...input,
    departmentId: input.departmentId.trim(),
    title: input.title.trim(),
    body: input.body?.trim() ?? "",
  };
}

export function validateAnnouncementInput(
  input: AnnouncementInput,
): Record<string, string> {
  const trimmed = trimAnnouncementInput(input);
  const errors: Record<string, string> = {};
  if (!trimmed.departmentId) {
    errors.departmentId = "Department is required.";
  }
  if (!trimmed.title) {
    errors.title = "Title is required.";
  }
  const visibility = trimmed.visibility ?? "department";
  if (!["department", "staff", "school"].includes(visibility)) {
    errors.visibility = "Invalid visibility.";
  }
  const status = trimmed.status ?? "draft";
  if (!["draft", "published", "retracted"].includes(status)) {
    errors.status = "Invalid status.";
  }
  return errors;
}

export function trimResourceInput(input: ResourceInput): ResourceInput {
  return {
    ...input,
    departmentId: input.departmentId.trim(),
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    url: input.url?.trim() ?? "",
    mediaId: input.mediaId?.trim() || null,
  };
}

export function validateResourceInput(
  input: ResourceInput,
): Record<string, string> {
  const trimmed = trimResourceInput(input);
  const errors: Record<string, string> = {};
  if (!trimmed.departmentId) {
    errors.departmentId = "Department is required.";
  }
  if (!trimmed.title) {
    errors.title = "Title is required.";
  }
  const type = trimmed.resourceType ?? "link";
  if (!["link", "file", "note", "other"].includes(type)) {
    errors.resourceType = "Invalid resource type.";
  }
  if (type === "link" && trimmed.url && !/^https?:\/\//i.test(trimmed.url)) {
    errors.url = "URL must start with http:// or https://.";
  }
  return errors;
}
