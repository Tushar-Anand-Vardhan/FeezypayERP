import type { createClient } from "@/lib/supabase/server";
import { deriveTeacherInsights } from "@/lib/teacher-analytics/rules";
import type {
  AssessmentCompletionAggregate,
  AttendanceCompletionAggregate,
  ClassesTaughtAggregate,
  DepartmentContributionAggregate,
  HomeworkCompletionAggregate,
  ProgressPoint,
  StudentPerformanceAggregate,
  TeacherAnalyticsAggregates,
  TeacherAnalyticsReport,
  WorkloadAggregate,
} from "@/lib/teacher-analytics/types";
import {
  TEACHER_ANALYTICS_THRESHOLDS,
  TEACHER_GENERATOR_VERSION,
} from "@/lib/teacher-analytics/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function percent(obtained: number, max: number): number | null {
  if (max <= 0) return null;
  return round2((obtained / max) * 100);
}

export async function buildTeacherAnalyticsReport(
  supabase: Supabase,
  schoolId: string,
  input: { employmentId: string; academicYearId: string },
): Promise<TeacherAnalyticsReport> {
  const generatedAt = new Date().toISOString();

  const classesTaught = await loadClassesTaught(
    supabase,
    schoolId,
    input.employmentId,
    input.academicYearId,
  );

  const [
    attendanceCompletion,
    assessmentCompletion,
    homeworkCompletion,
    averageStudentPerformance,
    departmentContribution,
  ] = await Promise.all([
    aggregateAttendanceCompletion(
      supabase,
      schoolId,
      input,
      classesTaught.sectionIds,
    ),
    aggregateAssessmentCompletion(supabase, schoolId, input),
    aggregateHomeworkCompletion(supabase, schoolId, input),
    aggregateStudentPerformance(
      supabase,
      schoolId,
      input,
      classesTaught.sectionIds,
      classesTaught.subjectIds,
    ),
    aggregateDepartmentContribution(supabase, schoolId, input.employmentId),
  ]);

  const workload = buildWorkload(
    classesTaught,
    homeworkCompletion,
    assessmentCompletion,
  );

  const aggregates: TeacherAnalyticsAggregates = {
    attendanceCompletion,
    assessmentCompletion,
    homeworkCompletion,
    averageStudentPerformance,
    workload,
    classesTaught,
    departmentContribution,
    aiInsights: {
      status: "not_built",
      note: "E23 AI insights FUTURE — deterministic metrics only in v1.",
    },
  };

  const insights = deriveTeacherInsights(aggregates);

  const progressGraphs = {
    attendanceCompletion: [
      {
        key: "by_teacher",
        label: "Marked by teacher",
        value:
          attendanceCompletion.completionRateByTeacher == null
            ? null
            : round2(attendanceCompletion.completionRateByTeacher * 100),
        meta: {
          completed: attendanceCompletion.sessionsCompletedByTeacher,
          expected: attendanceCompletion.sessionsExpected,
        },
      },
      {
        key: "section_coverage",
        label: "Section coverage",
        value:
          attendanceCompletion.sectionCoverageRate == null
            ? null
            : round2(attendanceCompletion.sectionCoverageRate * 100),
      },
    ] as ProgressPoint[],
    assessmentCompletion: [
      {
        key: "published_locked",
        label: "Published/locked",
        value:
          assessmentCompletion.completionRate == null
            ? null
            : round2(assessmentCompletion.completionRate * 100),
        meta: {
          done: assessmentCompletion.markSessionsPublishedOrLocked,
          total: assessmentCompletion.markSessionsTotal,
        },
      },
      {
        key: "draft",
        label: "Draft sessions",
        value: assessmentCompletion.markSessionsDraft,
      },
    ] as ProgressPoint[],
    homeworkGrading: [
      {
        key: "grading_rate",
        label: "Grading rate",
        value:
          homeworkCompletion.gradingRate == null
            ? null
            : round2(homeworkCompletion.gradingRate * 100),
        meta: {
          graded: homeworkCompletion.submissionsGraded,
          total: homeworkCompletion.submissionsTotal,
        },
      },
      {
        key: "open_homework",
        label: "Open homework",
        value: homeworkCompletion.assignedOpen,
      },
    ] as ProgressPoint[],
    studentPerformanceBySubject: averageStudentPerformance.bySubject.map(
      (s) => ({
        key: s.subjectId,
        label: s.subjectName ?? s.subjectId,
        value: s.averagePercent,
        meta: { resultCount: s.resultCount },
      }),
    ),
  };

  const sourceCounts = {
    weeklyPeriods: classesTaught.slots.length,
    sections: classesTaught.sectionCount,
    attendanceSessionsExpected: attendanceCompletion.sessionsExpected,
    markSessions: assessmentCompletion.markSessionsTotal,
    homeworkAssigned: homeworkCompletion.assignedTotal,
    studentResults: averageStudentPerformance.resultCount,
    departmentMemberships: departmentContribution.memberships.length,
  };

  void TEACHER_ANALYTICS_THRESHOLDS;

  return {
    employmentId: input.employmentId,
    academicYearId: input.academicYearId,
    generatedAt,
    generatorVersion: TEACHER_GENERATOR_VERSION,
    aggregates,
    insights,
    progressGraphs,
    sourceCounts,
  };
}

async function loadClassesTaught(
  supabase: Supabase,
  _schoolId: string,
  employmentId: string,
  academicYearId: string,
): Promise<ClassesTaughtAggregate> {
  const { data: slots } = await supabase
    .from("timetable_slots")
    .select(
      "id, day_of_week, period_definition_id, section_id, subject_id, teacher_id",
    )
    .eq("teacher_id", employmentId)
    .is("archived_at", null)
    .limit(500);

  let filtered = slots ?? [];
  const sectionIdsAll = [...new Set(filtered.map((s) => s.section_id))];
  const classIds: string[] = [];
  const sectionIds: string[] = [];

  if (sectionIdsAll.length) {
    const { data: sections } = await supabase
      .from("sections")
      .select("id, class_id, classes!inner(academic_year_id)")
      .in("id", sectionIdsAll);

    for (const s of sections ?? []) {
      const classes = s.classes as
        | { academic_year_id?: string }
        | { academic_year_id?: string }[]
        | null;
      const row = Array.isArray(classes) ? classes[0] : classes;
      if (row?.academic_year_id === academicYearId) {
        sectionIds.push(s.id as string);
        if (s.class_id) classIds.push(s.class_id as string);
      }
    }
    const inYear = new Set(sectionIds);
    filtered = filtered.filter((s) => inYear.has(s.section_id as string));
  }

  // Also include employment_subjects for subject breadth
  const { data: empSubjects } = await supabase
    .from("employment_subjects")
    .select("subject_id")
    .eq("employment_id", employmentId);

  const subjectIds = [
    ...new Set([
      ...filtered.map((s) => s.subject_id as string).filter(Boolean),
      ...(empSubjects ?? []).map((e) => e.subject_id as string),
    ]),
  ];

  const uniqueSections = [...new Set(sectionIds)];
  const uniqueClasses = [...new Set(classIds)];

  return {
    sectionIds: uniqueSections,
    classIds: uniqueClasses,
    subjectIds,
    sectionCount: uniqueSections.length,
    classCount: uniqueClasses.length,
    subjectCount: subjectIds.length,
    slots: filtered.map((s) => ({
      sectionId: s.section_id as string,
      subjectId: (s.subject_id as string) ?? null,
      dayOfWeek: s.day_of_week as number,
      periodDefinitionId: s.period_definition_id as string,
    })),
  };
}

async function aggregateAttendanceCompletion(
  supabase: Supabase,
  schoolId: string,
  input: { employmentId: string; academicYearId: string },
  taughtSectionIds: string[],
): Promise<AttendanceCompletionAggregate> {
  if (!taughtSectionIds.length) {
    return {
      taughtSectionCount: 0,
      sessionsExpected: 0,
      sessionsCompletedByTeacher: 0,
      sessionsCompletedOnSections: 0,
      completionRateByTeacher: null,
      sectionCoverageRate: null,
      byWorkflow: {},
    };
  }

  const { data: sessions } = await supabase
    .from("attendance_sessions")
    .select(
      "id, section_id, workflow_status, taken_by_employment_id, attendance_date",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .in("section_id", taughtSectionIds)
    .limit(2000);

  const rows = sessions ?? [];
  const byWorkflow: Record<string, number> = {};
  let sessionsCompletedByTeacher = 0;
  let sessionsCompletedOnSections = 0;

  for (const s of rows) {
    const wf = (s.workflow_status as string) ?? "draft";
    byWorkflow[wf] = (byWorkflow[wf] ?? 0) + 1;
    const done = wf === "submitted" || wf === "approved" || wf === "locked";
    if (done) sessionsCompletedOnSections += 1;
    if (
      done &&
      s.taken_by_employment_id === input.employmentId
    ) {
      sessionsCompletedByTeacher += 1;
    }
  }

  // Also count records marked by this teacher if sessions missing taker
  const { data: records } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .eq("recorded_by_employment_id", input.employmentId)
    .is("superseded_at", null)
    .eq("is_correction", false)
    .limit(1);

  const sessionsExpected = rows.length;
  const completionRateByTeacher =
    sessionsExpected === 0
      ? null
      : round2(sessionsCompletedByTeacher / sessionsExpected);
  const sectionCoverageRate =
    sessionsExpected === 0
      ? null
      : round2(sessionsCompletedOnSections / sessionsExpected);

  void records;

  return {
    taughtSectionCount: taughtSectionIds.length,
    sessionsExpected,
    sessionsCompletedByTeacher,
    sessionsCompletedOnSections,
    completionRateByTeacher,
    sectionCoverageRate,
    byWorkflow,
  };
}

async function aggregateAssessmentCompletion(
  supabase: Supabase,
  schoolId: string,
  input: { employmentId: string; academicYearId: string },
): Promise<AssessmentCompletionAggregate> {
  const { data: sessions } = await supabase
    .from("assessment_mark_sessions")
    .select("id, workflow_status")
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .eq("entered_by_employment_id", input.employmentId)
    .limit(500);

  const rows = sessions ?? [];
  let publishedOrLocked = 0;
  let draft = 0;
  for (const s of rows) {
    const wf = s.workflow_status as string;
    if (wf === "published" || wf === "locked") publishedOrLocked += 1;
    else if (wf === "draft") draft += 1;
  }

  const { count: resultsEntered } = await supabase
    .from("exam_results")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .eq("entered_by_employment_id", input.employmentId)
    .is("superseded_at", null);

  const { count: teacherCreated } = await supabase
    .from("exam_definitions")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("created_by_employment_id", input.employmentId)
    .is("archived_at", null);

  const total = rows.length;
  return {
    markSessionsTotal: total,
    markSessionsPublishedOrLocked: publishedOrLocked,
    markSessionsDraft: draft,
    completionRate: total === 0 ? null : round2(publishedOrLocked / total),
    resultsEntered: resultsEntered ?? 0,
    teacherCreatedAssessments: teacherCreated ?? 0,
  };
}

async function aggregateHomeworkCompletion(
  supabase: Supabase,
  schoolId: string,
  input: { employmentId: string; academicYearId: string },
): Promise<HomeworkCompletionAggregate> {
  const { data: homework } = await supabase
    .from("homework_assignments")
    .select("id, status")
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .eq("employment_id", input.employmentId)
    .is("archived_at", null)
    .limit(500);

  const rows = homework ?? [];
  let assignedOpen = 0;
  let assignedClosed = 0;
  for (const h of rows) {
    if (h.status === "closed") assignedClosed += 1;
    else if (h.status === "assigned" || h.status === "draft") assignedOpen += 1;
  }

  const homeworkIds = rows.map((h) => h.id as string);
  let submissionsTotal = 0;
  let submissionsGraded = 0;
  if (homeworkIds.length) {
    const { data: submissions } = await supabase
      .from("homework_submissions")
      .select("id, status")
      .eq("school_id", schoolId)
      .in("homework_id", homeworkIds)
      .is("archived_at", null)
      .limit(2000);
    for (const s of submissions ?? []) {
      submissionsTotal += 1;
      if (s.status === "graded" || s.status === "returned") {
        submissionsGraded += 1;
      }
    }
  }

  return {
    assignedTotal: rows.length,
    assignedOpen,
    assignedClosed,
    submissionsTotal,
    submissionsGraded,
    gradingRate:
      submissionsTotal === 0
        ? null
        : round2(submissionsGraded / submissionsTotal),
  };
}

async function aggregateStudentPerformance(
  supabase: Supabase,
  schoolId: string,
  input: { employmentId: string; academicYearId: string },
  sectionIds: string[],
  subjectIds: string[],
): Promise<StudentPerformanceAggregate> {
  if (!sectionIds.length && !subjectIds.length) {
    return {
      resultCount: 0,
      averagePercent: null,
      passRate: null,
      bySubject: [],
    };
  }

  let query = supabase
    .from("exam_results")
    .select(
      "id, subject_id, marks_obtained, max_marks, is_absent, section_id, entered_by_employment_id",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .is("superseded_at", null)
    .in("workflow_status", ["published", "locked"])
    .limit(3000);

  // Prefer results in taught sections; fall back to results entered by teacher
  if (sectionIds.length) {
    query = query.in("section_id", sectionIds);
  } else {
    query = query.eq("entered_by_employment_id", input.employmentId);
  }

  const { data } = await query;
  let rows = data ?? [];
  if (subjectIds.length) {
    const subSet = new Set(subjectIds);
    rows = rows.filter((r) => subSet.has(r.subject_id as string));
  }

  const subjectIdsUsed = [
    ...new Set(rows.map((r) => r.subject_id as string).filter(Boolean)),
  ];
  const { data: subjects } = subjectIdsUsed.length
    ? await supabase.from("subjects").select("id, name").in("id", subjectIdsUsed)
    : { data: [] as Array<{ id: string; name: string }> };
  const subjectMap = new Map((subjects ?? []).map((s) => [s.id, s.name]));

  let sumPct = 0;
  let scored = 0;
  let passEligible = 0;
  let passCount = 0;
  const bySubjectMap = new Map<string, number[]>();

  for (const r of rows) {
    if (r.is_absent) continue;
    if (r.marks_obtained == null || r.max_marks == null) continue;
    const pct = percent(Number(r.marks_obtained), Number(r.max_marks));
    if (pct == null) continue;
    sumPct += pct;
    scored += 1;
    passEligible += 1;
    if (pct >= 33) passCount += 1;
    const sid = r.subject_id as string;
    const arr = bySubjectMap.get(sid) ?? [];
    arr.push(pct);
    bySubjectMap.set(sid, arr);
  }

  const bySubject = [...bySubjectMap.entries()].map(([subjectId, percents]) => ({
    subjectId,
    subjectName: subjectMap.get(subjectId) ?? null,
    averagePercent:
      percents.length === 0
        ? null
        : round2(percents.reduce((a, c) => a + c, 0) / percents.length),
    resultCount: percents.length,
  }));

  return {
    resultCount: rows.length,
    averagePercent: scored === 0 ? null : round2(sumPct / scored),
    passRate: passEligible === 0 ? null : round2(passCount / passEligible),
    bySubject,
  };
}

async function aggregateDepartmentContribution(
  supabase: Supabase,
  schoolId: string,
  employmentId: string,
): Promise<DepartmentContributionAggregate> {
  const { data: employment } = await supabase
    .from("teacher_employments")
    .select("id, is_hod, department_id")
    .eq("id", employmentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  const { data: memberships } = await supabase
    .from("department_memberships")
    .select("department_id, role, departments!inner(id, name, school_id)")
    .eq("employment_id", employmentId)
    .is("left_on", null)
    .limit(50);

  const membershipRows: DepartmentContributionAggregate["memberships"] = [];
  for (const m of memberships ?? []) {
    const dept = m.departments as
      | { id?: string; name?: string; school_id?: string }
      | { id?: string; name?: string; school_id?: string }[]
      | null;
    const row = Array.isArray(dept) ? dept[0] : dept;
    if (row?.school_id && row.school_id !== schoolId) continue;
    membershipRows.push({
      departmentId: m.department_id as string,
      departmentName: row?.name ?? null,
      role: (m.role as string) ?? "member",
    });
  }

  const { count: teachingAssignments } = await supabase
    .from("department_teaching_assignments")
    .select("id", { count: "exact", head: true })
    .eq("employment_id", employmentId)
    .is("ended_on", null);

  const departmentIds = [
    ...new Set([
      ...membershipRows.map((m) => m.departmentId),
      ...(employment?.department_id ? [employment.department_id as string] : []),
    ]),
  ];

  return {
    memberships: membershipRows,
    teachingAssignments: teachingAssignments ?? 0,
    isHod: Boolean(employment?.is_hod),
    departmentIds,
  };
}

function buildWorkload(
  classes: ClassesTaughtAggregate,
  homework: HomeworkCompletionAggregate,
  assessment: AssessmentCompletionAggregate,
): WorkloadAggregate {
  const weeklyPeriods = classes.slots.length;
  const openHomework = homework.assignedOpen;
  const draftMarkSessions = assessment.markSessionsDraft;
  // Simple deterministic score: periods + 2*open homework + 3*draft sessions
  const workloadScore =
    weeklyPeriods + openHomework * 2 + draftMarkSessions * 3;

  return {
    weeklyPeriods,
    uniqueSections: classes.sectionCount,
    uniqueSubjects: classes.subjectCount,
    openHomework,
    draftMarkSessions,
    workloadScore,
  };
}
