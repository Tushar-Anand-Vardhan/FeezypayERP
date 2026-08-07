import { redirect } from "next/navigation";
import { TeacherEventsClient } from "@/components/teacher-portal/events-client";
import { requirePermission } from "@/lib/authz/require";
import { listActivityEventsAction } from "@/lib/events";
import { getActiveAcademicYearId } from "@/lib/teacher-portal/server-helpers";
import { createClient } from "@/lib/supabase/server";

export default async function TeacherEventsPage() {
  const authzCtx = await requirePermission("engagement.event.read");
  if ("error" in authzCtx) {
    redirect("/dashboard/teacher");
  }

  const supabase = await createClient();
  const academicYearId = await getActiveAcademicYearId(
    supabase,
    authzCtx.schoolId,
  );
  if (!academicYearId) {
    return <p className="text-sm text-muted">No academic year configured.</p>;
  }

  const listed = await listActivityEventsAction({ academicYearId });
  const events = (listed.success ? listed.rows : []).map((e) => ({
    id: String(e.id),
    title: String(e.title ?? "Event"),
    category: String(e.category ?? ""),
    startsAt: e.starts_at ? String(e.starts_at) : null,
    endsAt: e.ends_at ? String(e.ends_at) : null,
    location: e.location ? String(e.location) : null,
    approvalStatus: String(e.approval_status ?? ""),
  }));

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Events
        </h1>
        <p className="mt-2 text-sm text-muted">
          Upcoming and recent school / house / club activities.
        </p>
      </header>
      <TeacherEventsClient events={events} />
    </>
  );
}
