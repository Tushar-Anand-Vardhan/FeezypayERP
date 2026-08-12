import { redirect } from "next/navigation";
import { TeacherMarksClient } from "@/components/teacher-portal/marks-client";
import { requirePermission } from "@/lib/authz/require";
import {
  listScheduledAssessmentsAction,
  listSessionMarksAction,
} from "@/lib/assessment";
import { isMarkingWindowOpen } from "@/lib/assessment/ops-validation";
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
  const scheduleIds = (scheduled.success ? scheduled.rows : [])
    .map((row) => String(row.id ?? row.schedule_id ?? ""))
    .filter(Boolean);

  const windowById = new Map<
    string,
    { opens: string | null; closes: string | null }
  >();
  if (scheduleIds.length > 0) {
    const { data: windows } = await supabase
      .from("exam_subject_schedules")
      .select("id, marking_opens_at, marking_closes_at")
      .in("id", scheduleIds);
    for (const w of windows ?? []) {
      windowById.set(String(w.id), {
        opens: w.marking_opens_at ? String(w.marking_opens_at) : null,
        closes: w.marking_closes_at ? String(w.marking_closes_at) : null,
      });
    }
  }

  const schedules = (scheduled.success ? scheduled.rows : [])
    .map((row) => {
      const scheduleId = String(row.id ?? row.schedule_id ?? "");
      const examDefinitionId = String(row.exam_definition_id ?? "");
      const subjectId = String(row.subject_id ?? "");
      const examName = String(row.exam_name ?? row.name ?? "Assessment");
      const subjectName = String(row.subject_name ?? "");
      const win = windowById.get(scheduleId);
      return {
        scheduleId,
        examDefinitionId,
        subjectId,
        label:
          [examName, subjectName].filter(Boolean).join(" · ") || scheduleId,
        maxMarks: row.max_marks != null ? Number(row.max_marks) : null,
        sectionId: row.section_id ? String(row.section_id) : null,
        classId: row.class_id ? String(row.class_id) : null,
        markingOpen: isMarkingWindowOpen({
          markingOpensAt: win?.opens ?? null,
          markingClosesAt: win?.closes ?? null,
        }),
      };
    })
    .filter((s) => s.scheduleId && s.examDefinitionId && s.subjectId);

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
    admissionNumber: string | null;
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
      const { data: placements } = await supabase
        .from("student_academic_years")
        .select(
          "student_admissions!inner(student_profile_id, admission_number)",
        )
        .eq("section_id", selected.sectionId)
        .eq("status", "active")
        .is("left_on", null);
      const admByProfile = new Map<string, string | null>();
      for (const p of placements ?? []) {
        const adm = p.student_admissions as
          | {
              student_profile_id?: string;
              admission_number?: string | null;
            }
          | {
              student_profile_id?: string;
              admission_number?: string | null;
            }[]
          | null;
        const row = Array.isArray(adm) ? adm[0] : adm;
        if (row?.student_profile_id) {
          admByProfile.set(
            row.student_profile_id,
            row.admission_number ?? null,
          );
        }
      }
      students = roster.map((r) => {
        const existing = byStudent.get(r.studentProfileId);
        return {
          studentProfileId: r.studentProfileId,
          fullName: r.fullName,
          marksObtained: existing?.marks ?? "",
          isAbsent: existing?.absent ?? false,
          admissionNumber: admByProfile.get(r.studentProfileId) ?? null,
        };
      });
    } else {
      students = [...byStudent.entries()].map(([id, v]) => ({
        studentProfileId: id,
        fullName: id.slice(0, 8),
        marksObtained: v.marks,
        isAbsent: v.absent,
        admissionNumber: null,
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
          Enter and publish assessment marks, or upload a CSV (WF-TCH-05). Uses
          Assessment Operations Engine — no parallel store.
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
