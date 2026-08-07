import { redirect } from "next/navigation";
import { StudentHomeworkClient } from "@/components/student-portal/homework-client";
import { requirePermission } from "@/lib/authz/require";
import { listStudentHomeworkAction } from "@/lib/homework";
import {
  getActiveAcademicYearId,
  resolveStudentPortalContext,
} from "@/lib/student-portal/context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ studentProfileId?: string }>;
};

export default async function StudentHomeworkPage({ searchParams }: PageProps) {
  const authz = await requirePermission("homework.read");
  if ("error" in authz) redirect("/dashboard/student");

  const params = await searchParams;
  const resolved = await resolveStudentPortalContext({
    studentProfileId: params.studentProfileId,
  });
  if (!resolved.success) {
    return <p className="text-sm text-muted">{resolved.error}</p>;
  }

  const supabase = await createClient();
  const academicYearId = await getActiveAcademicYearId(
    supabase,
    resolved.context.schoolId,
  );
  if (!academicYearId) {
    return <p className="text-sm text-muted">No academic year configured.</p>;
  }

  const listed = await listStudentHomeworkAction({
    studentProfileId: resolved.context.studentProfileId,
    academicYearId,
  });
  const rows = (listed.success ? listed.rows : []).map((r) => {
    const submission = r.submission as Record<string, unknown> | undefined;
    return {
      id: String(r.id),
      title: String(r.title ?? "Homework"),
      dueOn: r.due_on ? String(r.due_on) : null,
      status: String(r.status ?? ""),
      submissionStatus: submission?.status
        ? String(submission.status)
        : null,
    };
  });

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Homework
        </h1>
        <p className="mt-2 text-sm text-muted">Assigned work for your sections.</p>
      </header>
      <StudentHomeworkClient rows={rows} />
    </>
  );
}
