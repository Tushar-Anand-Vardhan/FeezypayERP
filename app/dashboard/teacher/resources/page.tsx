import { redirect } from "next/navigation";
import { TeacherResourcesClient } from "@/components/teacher-portal/resources-client";
import { requirePermission } from "@/lib/authz/require";
import { listDepartmentsAction } from "@/lib/departments/departments-actions";
import { listDepartmentResourcesAction } from "@/lib/departments/resources-actions";

type PageProps = {
  searchParams: Promise<{ department?: string }>;
};

export default async function TeacherResourcesPage({ searchParams }: PageProps) {
  const authzCtx = await requirePermission("workforce.department.read");
  if ("error" in authzCtx) {
    redirect("/dashboard/teacher");
  }

  const params = await searchParams;
  const depts = await listDepartmentsAction();
  const departments = depts.success
    ? depts.departments.map((d) => ({ id: d.id, name: d.name }))
    : [];
  const departmentId =
    params.department && departments.some((d) => d.id === params.department)
      ? params.department
      : (departments[0]?.id ?? null);

  let resources: Array<{
    id: string;
    title: string;
    description: string | null;
    resourceType: string;
    url: string | null;
  }> = [];
  if (departmentId) {
    const listed = await listDepartmentResourcesAction(departmentId);
    if (listed.success) {
      resources = listed.resources.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        resourceType: r.resource_type,
        url: r.url,
      }));
    }
  }

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Resources
        </h1>
        <p className="mt-2 text-sm text-muted">
          Department teaching resources and links.
        </p>
      </header>
      <TeacherResourcesClient
        departments={departments}
        selectedDepartmentId={departmentId}
        resources={resources}
        canCreate={authzCtx.actor.permissionKeys.has(
          "workforce.department.edit",
        )}
      />
    </>
  );
}
