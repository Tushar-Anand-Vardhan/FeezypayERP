import { redirect } from "next/navigation";
import { StudentBehaviourClient } from "@/components/student-portal/behaviour-client";
import { requirePermission } from "@/lib/authz/require";
import { listBehaviourRemarksAction } from "@/lib/behaviour";
import {
  getActiveAcademicYearId,
  resolveStudentPortalContext,
} from "@/lib/student-portal/context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ studentProfileId?: string }>;
};

export default async function StudentBehaviourPage({
  searchParams,
}: PageProps) {
  const authz = await requirePermission("conduct.incident.read");
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

  const listed = await listBehaviourRemarksAction({
    academicYearId,
    studentProfileId: resolved.context.studentProfileId,
    visibleOnly: true,
  });
  const rows = (listed.success ? listed.rows : []).map((r) => ({
    id: String(r.id),
    title: String(r.title ?? "Remark"),
    kind: String(r.remark_kind ?? ""),
    visibility: String(r.visibility ?? ""),
    recordedAt: r.recorded_at ? String(r.recorded_at) : null,
  }));

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Behaviour
        </h1>
        <p className="mt-2 text-sm text-muted">
          Remarks visible to students.
        </p>
      </header>
      <StudentBehaviourClient rows={rows} />
    </>
  );
}
