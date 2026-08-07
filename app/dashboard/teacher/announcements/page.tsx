import { redirect } from "next/navigation";
import { TeacherAnnouncementsClient } from "@/components/teacher-portal/announcements-client";
import { requirePermission } from "@/lib/authz/require";
import { listCommMessagesAction } from "@/lib/communications";
import { listDepartmentAnnouncementsAction } from "@/lib/departments/announcements-actions";
import { listDepartmentsAction } from "@/lib/departments/departments-actions";
import { getActiveAcademicYearId } from "@/lib/teacher-portal/server-helpers";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ department?: string }>;
};

export default async function TeacherAnnouncementsPage({
  searchParams,
}: PageProps) {
  const authzCtx = await requirePermission("communication.message.read");
  if ("error" in authzCtx) {
    redirect("/dashboard/teacher");
  }

  const supabase = await createClient();
  const params = await searchParams;
  const academicYearId = await getActiveAcademicYearId(
    supabase,
    authzCtx.schoolId,
  );

  const messagesResult = await listCommMessagesAction({
    academicYearId: academicYearId ?? undefined,
    status: "published",
    limit: 40,
  });
  const messages = (messagesResult.success ? messagesResult.rows : []).map(
    (m) => ({
      id: String(m.id),
      title: String(m.title ?? "Message"),
      kind: String(m.message_kind ?? ""),
      status: String(m.status ?? ""),
      publishedAt: m.published_at ? String(m.published_at) : null,
      source: "school" as const,
    }),
  );

  const depts = await listDepartmentsAction();
  const departments = depts.success
    ? depts.departments.map((d) => ({ id: d.id, name: d.name }))
    : [];
  const departmentId =
    params.department && departments.some((d) => d.id === params.department)
      ? params.department
      : (departments[0]?.id ?? null);

  let deptAnnouncements: Array<{
    id: string;
    title: string;
    kind: string;
    status: string;
    publishedAt: string | null;
    source: "department";
  }> = [];
  if (departmentId) {
    const listed = await listDepartmentAnnouncementsAction(departmentId);
    if (listed.success) {
      deptAnnouncements = listed.announcements
        .filter((a) => a.status === "published")
        .map((a) => ({
          id: a.id,
          title: a.title,
          kind: "department",
          status: a.status,
          publishedAt: a.published_at,
          source: "department" as const,
        }));
    }
  }

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Announcements
        </h1>
        <p className="mt-2 text-sm text-muted">
          School messages and department notices.
        </p>
      </header>
      <TeacherAnnouncementsClient
        messages={[...messages, ...deptAnnouncements]}
        departments={departments}
        selectedDepartmentId={departmentId}
      />
    </>
  );
}
