import { redirect } from "next/navigation";
import { TeacherDepartmentClient } from "@/components/teacher-portal/department-client";
import { requirePermission } from "@/lib/authz/require";
import { listDepartmentAnnouncementsAction } from "@/lib/departments/announcements-actions";
import { listDepartmentsAction } from "@/lib/departments/departments-actions";
import { listDepartmentMembershipsAction } from "@/lib/departments/memberships-actions";
import { listDepartmentSubjectsAction } from "@/lib/departments/subjects-actions";

type PageProps = {
  searchParams: Promise<{ department?: string; employment?: string }>;
};

export default async function TeacherDepartmentPage({
  searchParams,
}: PageProps) {
  const authzCtx = await requirePermission("workforce.department.read");
  if ("error" in authzCtx) {
    redirect("/dashboard/teacher");
  }

  const params = await searchParams;
  const depts = await listDepartmentsAction();
  const departments = depts.success
    ? depts.departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        description: d.description,
      }))
    : [];
  const departmentId =
    params.department && departments.some((d) => d.id === params.department)
      ? params.department
      : (departments[0]?.id ?? null);

  let memberships: Array<{
    id: string;
    employmentId: string;
    role: string;
    joinedOn: string;
  }> = [];
  let subjects: Array<{ id: string; subjectId: string; isPrimary: boolean }> =
    [];
  let announcements: Array<{
    id: string;
    title: string;
    status: string;
    publishedAt: string | null;
  }> = [];

  if (departmentId) {
    const [mem, sub, ann] = await Promise.all([
      listDepartmentMembershipsAction(departmentId),
      listDepartmentSubjectsAction(departmentId),
      listDepartmentAnnouncementsAction(departmentId),
    ]);
    if (mem.success) {
      memberships = mem.memberships.map((m) => ({
        id: m.id,
        employmentId: m.employment_id,
        role: m.role,
        joinedOn: m.joined_on,
      }));
    }
    if (sub.success) {
      subjects = sub.subjects.map((s) => ({
        id: s.id,
        subjectId: s.subject_id,
        isPrimary: Boolean(s.is_primary),
      }));
    }
    if (ann.success) {
      announcements = ann.announcements.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        publishedAt: a.published_at,
      }));
    }
  }

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Department
        </h1>
        <p className="mt-2 text-sm text-muted">
          Membership, subjects, and department notices.
        </p>
      </header>
      <TeacherDepartmentClient
        departments={departments}
        selectedDepartmentId={departmentId}
        memberships={memberships}
        subjects={subjects}
        announcements={announcements}
        canCompose={authzCtx.actor.permissionKeys.has(
          "workforce.department.edit",
        )}
      />
    </>
  );
}
