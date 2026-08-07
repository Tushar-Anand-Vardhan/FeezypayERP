import { redirect } from "next/navigation";
import { TeacherHomeworkClient } from "@/components/teacher-portal/homework-client";
import { requireAnyPermission } from "@/lib/authz/require";
import { listHomeworkAction } from "@/lib/homework";
import {
  getActiveAcademicYearId,
  listTeacherSections,
} from "@/lib/teacher-portal/server-helpers";
import { listActiveEmployments } from "@/lib/teacher-workspace/server-helpers";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ employment?: string }>;
};

export default async function TeacherHomeworkPage({ searchParams }: PageProps) {
  const authzCtx = await requireAnyPermission([
    "homework.read",
    "homework.assign",
  ]);
  if ("error" in authzCtx) {
    redirect("/dashboard/teacher");
  }

  const supabase = await createClient();
  const params = await searchParams;
  const employments = await listActiveEmployments(supabase, authzCtx.schoolId);
  const employmentId =
    params.employment &&
    employments.some((e) => e.employmentId === params.employment)
      ? params.employment
      : (employments[0]?.employmentId ?? null);

  if (!employmentId) {
    return <p className="text-sm text-muted">No employment selected.</p>;
  }

  const academicYearId = await getActiveAcademicYearId(
    supabase,
    authzCtx.schoolId,
  );
  if (!academicYearId) {
    return <p className="text-sm text-muted">No academic year configured.</p>;
  }

  const sections = await listTeacherSections(
    supabase,
    authzCtx.schoolId,
    employmentId,
  );
  const listed = await listHomeworkAction({
    academicYearId,
    employmentId,
    limit: 50,
  });
  const rows = (listed.success ? listed.rows : []).map((r) => ({
    id: String(r.id),
    title: String(r.title ?? "Homework"),
    status: String(r.status ?? "draft"),
    dueOn: r.due_on ? String(r.due_on) : null,
    sectionId: r.section_id ? String(r.section_id) : null,
  }));

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Homework
        </h1>
        <p className="mt-2 text-sm text-muted">
          Assign and publish homework (WF-TCH-04).
        </p>
      </header>
      <TeacherHomeworkClient
        employmentId={employmentId}
        academicYearId={academicYearId}
        sections={sections}
        rows={rows}
      />
    </>
  );
}
