import { redirect } from "next/navigation";
import { TeacherBehaviourClient } from "@/components/teacher-portal/behaviour-client";
import { requireAnyPermission } from "@/lib/authz/require";
import { listBehaviourRemarksAction } from "@/lib/behaviour";
import {
  getActiveAcademicYearId,
  listTeacherSections,
  loadSectionRosterWithNames,
} from "@/lib/teacher-portal/server-helpers";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ employment?: string }>;
};

export default async function TeacherBehaviourPage({ searchParams }: PageProps) {
  const authzCtx = await requireAnyPermission([
    "conduct.incident.record",
    "conduct.incident.read",
  ]);
  if ("error" in authzCtx) {
    redirect("/dashboard/teacher");
  }

  const supabase = await createClient();
  const params = await searchParams;
  const employmentId = params.employment ?? null;
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
  const students: Array<{ studentProfileId: string; fullName: string }> = [];
  for (const section of sections.slice(0, 5)) {
    const roster = await loadSectionRosterWithNames(supabase, section.id);
    for (const s of roster) {
      if (!students.some((x) => x.studentProfileId === s.studentProfileId)) {
        students.push(s);
      }
    }
  }

  const listed = await listBehaviourRemarksAction({ academicYearId });
  const remarks = (listed.success ? listed.rows : []).map((r) => ({
    id: String(r.id),
    title: String(r.title ?? "Remark"),
    remarkKind: String(r.remark_kind ?? ""),
    visibility: String(r.visibility ?? ""),
    recordedAt: r.recorded_at ? String(r.recorded_at) : null,
    studentProfileId: String(r.student_profile_id ?? ""),
  }));

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Behaviour
        </h1>
        <p className="mt-2 text-sm text-muted">
          Record conduct remarks for your students.
        </p>
      </header>
      <TeacherBehaviourClient
        employmentId={employmentId}
        academicYearId={academicYearId}
        students={students}
        remarks={remarks}
      />
    </>
  );
}
