import { redirect } from "next/navigation";
import { StudentAssessmentsClient } from "@/components/student-portal/assessments-client";
import { requirePermission } from "@/lib/authz/require";
import { listStudentMarksAction } from "@/lib/assessment";
import {
  getActiveAcademicYearId,
  resolveStudentPortalContext,
} from "@/lib/student-portal/context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ studentProfileId?: string }>;
};

export default async function StudentAssessmentsPage({
  searchParams,
}: PageProps) {
  const authz = await requirePermission("assessment.results.read");
  if ("error" in authz) redirect("/dashboard/parent");

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

  const listed = await listStudentMarksAction({
    studentProfileId: resolved.context.studentProfileId,
    academicYearId: academicYearId ?? undefined,
    visibleOnly: true,
  });
  const rows = (listed.success ? listed.rows : []).map((r) => ({
    id: String(r.id),
    title: String(r.exam_definition_id ?? "Assessment").slice(0, 8),
    subject: r.subject_id ? String(r.subject_id).slice(0, 8) : null,
    marks:
      r.marks_obtained != null
        ? `${String(r.marks_obtained)}${r.max_marks != null ? ` / ${String(r.max_marks)}` : ""}`
        : r.is_absent
          ? "Absent"
          : null,
    grade: r.grade_label ? String(r.grade_label) : null,
    publishedAt: r.published_at ? String(r.published_at) : null,
  }));

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Assessments
        </h1>
        <p className="mt-2 text-sm text-muted">
          Published results visible for your child.
        </p>
      </header>
      <StudentAssessmentsClient rows={rows} />
    </>
  );
}
