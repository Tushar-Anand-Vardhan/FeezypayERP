import { redirect } from "next/navigation";
import { StudentAttendanceClient } from "@/components/student-portal/attendance-client";
import { requirePermission } from "@/lib/authz/require";
import { listStudentAttendanceAction } from "@/lib/attendance";
import { resolveStudentPortalContext } from "@/lib/student-portal/context";

type PageProps = {
  searchParams: Promise<{ studentProfileId?: string }>;
};

export default async function StudentAttendancePage({
  searchParams,
}: PageProps) {
  const authz = await requirePermission("attendance.record.read");
  if ("error" in authz) redirect("/dashboard/student");

  const params = await searchParams;
  const resolved = await resolveStudentPortalContext({
    studentProfileId: params.studentProfileId,
  });
  if (!resolved.success) {
    return <p className="text-sm text-muted">{resolved.error}</p>;
  }

  const listed = await listStudentAttendanceAction({
    studentProfileId: resolved.context.studentProfileId,
    visibleOnly: true,
  });
  const records = (listed.success ? listed.records : []).map((r) => ({
    id: String(r.id),
    date: String(r.attendance_date ?? ""),
    status: String(r.status ?? ""),
    sessionLabel: r.scope ? String(r.scope) : null,
  }));

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Attendance
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your attendance records visible to students.
        </p>
      </header>
      <StudentAttendanceClient records={records} />
    </>
  );
}
