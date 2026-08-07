import { redirect } from "next/navigation";
import { StudentEventsClient } from "@/components/student-portal/events-client";
import { requirePermission } from "@/lib/authz/require";
import { listStudentEventParticipationsAction } from "@/lib/events";
import {
  getActiveAcademicYearId,
  resolveStudentPortalContext,
} from "@/lib/student-portal/context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ studentProfileId?: string }>;
};

export default async function StudentEventsPage({ searchParams }: PageProps) {
  const authz = await requirePermission("engagement.event.read");
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

  const listed = await listStudentEventParticipationsAction({
    studentProfileId: resolved.context.studentProfileId,
    academicYearId: academicYearId ?? undefined,
  });
  const rows = (listed.success ? listed.rows : []).map((r) => {
    const event = r.event as Record<string, unknown> | undefined;
    return {
      id: String(r.id),
      title: String(event?.title ?? "Event"),
      role: r.participation_role ? String(r.participation_role) : null,
      startsAt: event?.starts_at ? String(event.starts_at) : null,
    };
  });

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Events
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your event participations.
        </p>
      </header>
      <StudentEventsClient rows={rows} />
    </>
  );
}
