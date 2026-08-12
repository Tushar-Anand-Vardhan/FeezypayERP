import { redirect } from "next/navigation";
import { TeacherStudentsClient } from "@/components/teacher-portal/students-client";
import { requirePermission } from "@/lib/authz/require";
import { createClient } from "@/lib/supabase/server";
import {
  listTeacherSections,
  loadTeacherStudentRoster,
  resolveTeacherEmploymentId,
} from "@/lib/teacher-portal/students";

type PageProps = {
  searchParams: Promise<{
    employment?: string;
    sectionId?: string;
  }>;
};

export default async function TeacherStudentsPage({ searchParams }: PageProps) {
  const authzCtx = await requirePermission("enrollment.admission.read");
  if ("error" in authzCtx) {
    redirect("/dashboard/teacher");
  }

  const params = await searchParams;
  const employmentId = await resolveTeacherEmploymentId(
    authzCtx.schoolId,
    params.employment ?? null,
  );

  const supabase = await createClient();
  const sections = await listTeacherSections(
    supabase,
    authzCtx.schoolId,
    employmentId,
  );
  const sectionId = params.sectionId ?? sections[0]?.id ?? null;
  const students = sectionId
    ? await loadTeacherStudentRoster({
        schoolId: authzCtx.schoolId,
        sectionId,
      })
    : [];

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Students
        </h1>
        <p className="mt-2 text-sm text-muted">
          Scoped to classes and sections you teach. Open a student for marks,
          remarks, and event participation (WF-TCH-05 / WF-TCH-03).
        </p>
      </header>
      <TeacherStudentsClient
        employmentId={employmentId}
        sections={sections}
        sectionId={sectionId}
        students={students}
      />
    </>
  );
}
