import { redirect } from "next/navigation";
import { TeacherStudentSheetClient } from "@/components/teacher-portal/student-sheet-client";
import { requirePermission } from "@/lib/authz/require";
import { listActivityEventsAction } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveAcademicYearId,
  loadTeacherStudentSheet,
  resolveTeacherEmploymentId,
} from "@/lib/teacher-portal/students";

type PageProps = {
  params: Promise<{ studentProfileId: string }>;
  searchParams: Promise<{
    employment?: string;
    sectionId?: string;
  }>;
};

export default async function TeacherStudentSheetPage({
  params,
  searchParams,
}: PageProps) {
  const authzCtx = await requirePermission("enrollment.admission.read");
  if ("error" in authzCtx) {
    redirect("/dashboard/teacher");
  }

  const { studentProfileId } = await params;
  const query = await searchParams;
  const employmentId = await resolveTeacherEmploymentId(
    authzCtx.schoolId,
    query.employment ?? null,
  );

  const supabase = await createClient();
  const academicYearId = await getActiveAcademicYearId(
    supabase,
    authzCtx.schoolId,
  );
  if (!academicYearId) {
    return <p className="text-sm text-muted">No academic year configured.</p>;
  }

  const sheet = await loadTeacherStudentSheet({
    schoolId: authzCtx.schoolId,
    employmentId,
    studentProfileId,
  });

  if (!sheet.success) {
    return <p className="text-sm text-muted">{sheet.error}</p>;
  }

  const listed = await listActivityEventsAction({ academicYearId });
  const events = (listed.success ? listed.rows : []).map((e) => ({
    id: String(e.id),
    title: String(e.title ?? "Event"),
  }));

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Student
        </h1>
        <p className="mt-2 text-sm text-muted">
          Subjects you teach, open marking windows, remarks, and event
          participation.
        </p>
      </header>
      <TeacherStudentSheetClient
        employmentId={employmentId}
        academicYearId={academicYearId}
        sectionId={query.sectionId ?? sheet.student.sectionId}
        student={sheet.student}
        subjects={sheet.subjects}
        openSchedules={sheet.openSchedules}
        events={events}
      />
    </>
  );
}
