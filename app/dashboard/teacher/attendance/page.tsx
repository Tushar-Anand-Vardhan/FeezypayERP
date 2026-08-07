import { redirect } from "next/navigation";
import { TeacherAttendanceClient } from "@/components/teacher-portal/attendance-client";
import { requirePermission } from "@/lib/authz/require";
import { listSectionAttendanceAction } from "@/lib/attendance";
import type { AttendanceMarkStatus } from "@/lib/attendance/types";
import {
  getActiveAcademicYearId,
  listTeacherSections,
  loadSectionRosterWithNames,
} from "@/lib/teacher-portal/server-helpers";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    employment?: string;
    sectionId?: string;
    date?: string;
  }>;
};

export default async function TeacherAttendancePage({ searchParams }: PageProps) {
  const authzCtx = await requirePermission("attendance.record.create");
  if ("error" in authzCtx) {
    redirect("/dashboard/teacher");
  }

  const supabase = await createClient();
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const attendanceDate = params.date ?? today;
  const employmentId = params.employment ?? null;

  const academicYearId = await getActiveAcademicYearId(
    supabase,
    authzCtx.schoolId,
  );
  if (!academicYearId) {
    return (
      <p className="text-sm text-muted">
        No academic year configured. Complete calendar onboarding first.
      </p>
    );
  }

  const sections = await listTeacherSections(
    supabase,
    authzCtx.schoolId,
    employmentId,
  );
  const sectionId = params.sectionId ?? sections[0]?.id ?? null;

  if (!sectionId) {
    return (
      <>
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Attendance
          </h1>
          <p className="mt-2 text-sm text-muted">
            No sections available for this employment yet.
          </p>
        </header>
      </>
    );
  }

  const sectionLabel =
    sections.find((s) => s.id === sectionId)?.label ?? sectionId;
  const roster = await loadSectionRosterWithNames(supabase, sectionId);
  const existing = await listSectionAttendanceAction({
    sectionId,
    attendanceDate,
  });

  const statusByStudent = new Map<string, AttendanceMarkStatus>();
  if (existing.success) {
    for (const rec of existing.records) {
      const sid = String(rec.student_profile_id ?? "");
      const status = String(rec.status ?? "present") as AttendanceMarkStatus;
      if (sid) statusByStudent.set(sid, status);
    }
  }

  const students = roster.map((r) => ({
    ...r,
    status: statusByStudent.get(r.studentProfileId) ?? ("present" as const),
  }));

  const sessionId =
    existing.success && existing.session
      ? String(existing.session.id ?? "")
      : null;

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Attendance
        </h1>
        <p className="mt-2 text-sm text-muted">
          Mark daily attendance and submit the session when ready (WF-TCH-01).
        </p>
      </header>
      <TeacherAttendanceClient
        employmentId={employmentId}
        academicYearId={academicYearId}
        sectionId={sectionId}
        attendanceDate={attendanceDate}
        sectionLabel={sectionLabel}
        students={students}
        sessionId={sessionId || null}
        sections={sections}
      />
    </>
  );
}
