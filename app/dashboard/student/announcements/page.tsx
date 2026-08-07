import { redirect } from "next/navigation";
import { StudentAnnouncementsClient } from "@/components/student-portal/announcements-client";
import { requirePermission } from "@/lib/authz/require";
import {
  getActiveAcademicYearId,
  resolveStudentPortalContext,
} from "@/lib/student-portal/context";
import { listMessagesForStudentAction } from "@/lib/student-portal/messages-actions";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ studentProfileId?: string }>;
};

export default async function StudentAnnouncementsPage({
  searchParams,
}: PageProps) {
  const authz = await requirePermission("communication.message.read");
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

  const listed = await listMessagesForStudentAction({
    studentProfileId: resolved.context.studentProfileId,
    academicYearId: academicYearId ?? undefined,
  });
  const rows = (listed.success ? listed.rows : []).map((r) => ({
    id: String(r.id),
    title: String(r.title ?? "Announcement"),
    kind: String(r.message_kind ?? ""),
    publishedAt: r.published_at ? String(r.published_at) : null,
    source: String(r.source ?? "message"),
  }));

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Announcements
        </h1>
        <p className="mt-2 text-sm text-muted">
          School and class messages for you.
        </p>
      </header>
      <StudentAnnouncementsClient rows={rows} />
    </>
  );
}
