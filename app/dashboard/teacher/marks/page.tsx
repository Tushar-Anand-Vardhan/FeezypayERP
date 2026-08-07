import { redirect } from "next/navigation";
import { TeacherMarksClient } from "@/components/teacher-portal/marks-client";
import { requirePermission } from "@/lib/authz/require";
import {
  listScheduledAssessmentsAction,
  listSessionMarksAction,
} from "@/lib/assessment";
import {
  getActiveAcademicYearId,
  loadSectionRosterWithNames,
} from "@/lib/teacher-portal/server-helpers";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    employment?: string;
    scheduleId?: string;
    examDefinitionId?: string;
    subjectId?: string;
  }>;
};

export default async function TeacherMarksPage({ searchParams }: PageProps) {
  const authzCtx = await requirePermission("assessment.results.enter");
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
    return (
      <p className="text-sm text-muted">No academic year configured.</p>
    );
  }

  const scheduled = await listScheduledAssessmentsAction({ academicYearId });
  const schedules = (scheduled.success ? scheduled.rows : []).map((row) => {
    const scheduleId = String(row.id ?? row.schedule_id ?? "");
    const examDefinitionId = String(row.exam_definition_id ?? "");
    const subjectId = String(row.subject_id ?? "");
    const examName = String(row.exam_name ?? row.name ?? "Assessment");
    const subjectName = String(row.subject_name ?? "");
    return {
      scheduleId,
      examDefinitionId,
      subjectId,
      label: [examName, subjectName].filter(Boolean).join(" · ") || scheduleId,
      maxMarks:
        row.max_marks != null ? Number(row.max_marks) : null,
      sectionId: row.section_id ? String(row.section_id) : null,
      classId: row.class_id ? String(row.class_id) : null,
    };
  }).filter((s) => s.scheduleId && s.examDefinitionId && s.subjectId);

  const selected =
    schedules.find((s) => s.scheduleId === params.scheduleId) ??
    schedules.find(
      (s) =>
        s.examDefinitionId === params.examDefinitionId &&
        s.subjectId === params.subjectId,
    ) ??
    null;

  let students: Array<{
    studentProfileId: string;
    fullName: string;
    marksObtained: string;
    isAbsent: boolean;
  }> = [];
  let sessionId: string | null = null;

  if (selected) {
    const marks = await listSessionMarksAction({
      examDefinitionId: selected.examDefinitionId,
      subjectId: selected.subjectId,
      sectionId: selected.sectionId ?? undefined,
    });
    const byStudent = new Map<
      string,
      { marks: string; absent: boolean; sessionId?: string }
    >();
    if (marks.success) {
      for (const row of marks.rows ?? []) {
        const sid = String(row.student_profile_id ?? "");
        if (!sid) continue;
        byStudent.set(sid, {
          marks:
            row.marks_obtained != null ? String(row.marks_obtained) : "",
          absent: Boolean(row.is_absent),
          sessionId: row.mark_session_id
            ? String(row.mark_session_id)
            : undefined,
        });
        if (!sessionId && row.mark_session_id) {
          sessionId = String(row.mark_session_id);
        }
      }
    }

    if (selected.sectionId) {
      const roster = await loadSectionRosterWithNames(
        supabase,
        selected.sectionId,
      );
      students = roster.map((r) => {
        const existing = byStudent.get(r.studentProfileId);
        return {
          studentProfileId: r.studentProfileId,
          fullName: r.fullName,
          marksObtained: existing?.marks ?? "",
          isAbsent: existing?.absent ?? false,
        };
      });
    } else {
      students = [...byStudent.entries()].map(([id, v]) => ({
        studentProfileId: id,
        fullName: id.slice(0, 8),
        marksObtained: v.marks,
        isAbsent: v.absent,
      }));
    }
  }

  return (
    <>
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Marks
        </h1>
        <p className="mt-2 text-sm text-muted">
          Enter and publish assessment marks (WF-TCH-05). Uses Assessment
          Operations Engine — no parallel store.
        </p>
      </header>
      <TeacherMarksClient
        employmentId={employmentId}
        academicYearId={academicYearId}
        schedules={schedules}
        selected={selected}
        students={students}
        sessionId={sessionId}
      />
    </>
  );
}
