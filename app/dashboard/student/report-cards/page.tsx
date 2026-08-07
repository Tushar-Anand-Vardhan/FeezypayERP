import { redirect } from "next/navigation";
import { StudentReportCardsClient } from "@/components/student-portal/report-cards-client";
import { requirePermission } from "@/lib/authz/require";
import { listReportCardIssuesAction } from "@/lib/report-cards";
import {
  getActiveAcademicYearId,
  resolveStudentPortalContext,
} from "@/lib/student-portal/context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ studentProfileId?: string }>;
};

export default async function StudentReportCardsPage({
  searchParams,
}: PageProps) {
  const authz = await requirePermission("document.report_card.read");
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

  const listed = await listReportCardIssuesAction({
    studentProfileId: resolved.context.studentProfileId,
    academicYearId: academicYearId ?? undefined,
    status: "issued",
  });
  // Also show drafts that are student-visible statuses if any issued empty
  const rows = (listed.success ? listed.rows : []).map((r) => ({
    id: String(r.id),
    title: String(r.title ?? "Report card"),
    status: String(r.status ?? ""),
    issuedAt: r.issued_at ? String(r.issued_at) : null,
  }));

  let display = rows;
  if (display.length === 0) {
    const all = await listReportCardIssuesAction({
      studentProfileId: resolved.context.studentProfileId,
      academicYearId: academicYearId ?? undefined,
    });
    display = (all.success ? all.rows : []).map((r) => ({
      id: String(r.id),
      title: String(r.title ?? "Report card"),
      status: String(r.status ?? ""),
      issuedAt: r.issued_at ? String(r.issued_at) : null,
    }));
  }

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Report cards
        </h1>
        <p className="mt-2 text-sm text-muted">
          Issued report cards for your admission.
        </p>
      </header>
      <StudentReportCardsClient rows={display} />
    </>
  );
}
