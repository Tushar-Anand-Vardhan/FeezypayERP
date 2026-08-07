import type { createClient } from "@/lib/supabase/server";
import { deriveInsights } from "@/lib/student-analytics/rules";
import type {
  AchievementItem,
  AssessmentAggregate,
  AttendanceAggregate,
  BehaviourAggregate,
  ParticipationAggregate,
  ProgressPoint,
  StudentAnalyticsAggregates,
  StudentAnalyticsReport,
  SubjectTrend,
  TeacherRemarkItem,
} from "@/lib/student-analytics/types";
import {
  ANALYTICS_THRESHOLDS,
  GENERATOR_VERSION,
} from "@/lib/student-analytics/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function percent(obtained: number, max: number): number | null {
  if (max <= 0) return null;
  return round2((obtained / max) * 100);
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export async function buildStudentAnalyticsReport(
  supabase: Supabase,
  schoolId: string,
  input: {
    studentProfileId: string;
    academicYearId: string;
    visibleOnly?: boolean;
  },
): Promise<StudentAnalyticsReport> {
  const generatedAt = new Date().toISOString();
  const visibleOnly = Boolean(input.visibleOnly);

  const [
    attendance,
    assessment,
    participation,
    behaviour,
  ] = await Promise.all([
    aggregateAttendance(supabase, schoolId, input),
    aggregateAssessment(supabase, schoolId, input, visibleOnly),
    aggregateParticipation(supabase, schoolId, input),
    aggregateBehaviour(supabase, schoolId, input, visibleOnly),
  ]);

  const [achievements, teacherRemarks] = await Promise.all([
    loadAchievements(supabase, schoolId, input),
    loadTeacherRemarks(supabase, schoolId, input, visibleOnly),
  ]);

  for (const sub of assessment.bySubject) {
    if (
      sub.averagePercent != null &&
      sub.averagePercent >= ANALYTICS_THRESHOLDS.subjectStrengthPercent &&
      sub.resultCount >= 2
    ) {
      achievements.push({
        source: "assessment_high",
        title: `Strong performance in ${sub.subjectName ?? "subject"}`,
        occurredOn: null,
        refId: sub.subjectId,
      });
    }
  }

  const aggregates: StudentAnalyticsAggregates = {
    attendance,
    assessment,
    subjectTrends: assessment.bySubject,
    participation,
    behaviour,
    achievements,
    teacherRemarks,
  };

  const insights = deriveInsights(aggregates);
  const progressGraphs = {
    attendanceByMonth: attendance.monthly,
    assessmentByExam: assessment.byExam,
    subjectTrends: assessment.bySubject,
  };

  const sourceCounts = {
    attendanceRecords: attendance.total,
    examResults: assessment.totalResults,
    eventParticipations: participation.eventCount,
    behaviourRemarks: behaviour.total,
    achievements: achievements.length,
    teacherRemarks: teacherRemarks.length,
  };

  return {
    studentProfileId: input.studentProfileId,
    academicYearId: input.academicYearId,
    generatedAt,
    generatorVersion: GENERATOR_VERSION,
    aggregates,
    insights,
    progressGraphs,
    sourceCounts,
  };
}

async function aggregateAttendance(
  supabase: Supabase,
  schoolId: string,
  input: { studentProfileId: string; academicYearId: string },
): Promise<AttendanceAggregate> {
  const { data } = await supabase
    .from("attendance_records")
    .select("status, attendance_date")
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .eq("student_profile_id", input.studentProfileId)
    .is("superseded_at", null)
    .eq("is_correction", false)
    .limit(2000);

  const rows = data ?? [];
  const byStatus: Record<string, number> = {};
  const monthBuckets = new Map<string, { presentish: number; total: number }>();

  for (const r of rows) {
    const st = (r.status as string) ?? "unknown";
    byStatus[st] = (byStatus[st] ?? 0) + 1;
    const mk = monthKey(r.attendance_date as string);
    const bucket = monthBuckets.get(mk) ?? { presentish: 0, total: 0 };
    bucket.total += 1;
    if (st === "present" || st === "late" || st === "half_day") {
      bucket.presentish += 1;
    }
    monthBuckets.set(mk, bucket);
  }

  const total = rows.length;
  const presentish =
    (byStatus.present ?? 0) + (byStatus.late ?? 0) + (byStatus.half_day ?? 0);
  const presentRate = total === 0 ? null : round2(presentish / total);
  const absentRate =
    total === 0 ? null : round2((byStatus.absent ?? 0) / total);

  const monthly: ProgressPoint[] = [...monthBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => ({
      key,
      label: key,
      value: b.total === 0 ? null : round2((b.presentish / b.total) * 100),
      meta: { total: b.total, presentish: b.presentish },
    }));

  return {
    total,
    byStatus,
    presentRate,
    absentRate,
    lateCount: byStatus.late ?? 0,
    monthly,
  };
}

async function aggregateAssessment(
  supabase: Supabase,
  schoolId: string,
  input: { studentProfileId: string; academicYearId: string },
  visibleOnly: boolean,
): Promise<AssessmentAggregate> {
  let query = supabase
    .from("exam_results")
    .select(
      "id, exam_definition_id, subject_id, marks_obtained, max_marks, is_absent, published_at, workflow_status, created_at, teacher_remark",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .eq("student_profile_id", input.studentProfileId)
    .is("superseded_at", null)
    .order("created_at", { ascending: true })
    .limit(1000);

  if (visibleOnly) {
    query = query.eq("workflow_status", "published");
  }

  const { data } = await query;
  const rows = data ?? [];

  const subjectIds = [
    ...new Set(rows.map((r) => r.subject_id as string).filter(Boolean)),
  ];
  const examIds = [
    ...new Set(
      rows.map((r) => r.exam_definition_id as string).filter(Boolean),
    ),
  ];

  const [{ data: subjects }, { data: exams }] = await Promise.all([
    subjectIds.length
      ? supabase.from("subjects").select("id, name").in("id", subjectIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    examIds.length
      ? supabase.from("exam_definitions").select("id, name").in("id", examIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const subjectMap = new Map((subjects ?? []).map((s) => [s.id, s.name]));
  const examMap = new Map((exams ?? []).map((e) => [e.id, e.name]));

  let sumPct = 0;
  let scored = 0;
  let absentCount = 0;
  let publishedCount = 0;
  let passEligible = 0;
  let passCount = 0;

  const bySubjectMap = new Map<
    string,
    { percents: number[]; points: ProgressPoint[] }
  >();
  const examBuckets = new Map<string, { sum: number; n: number }>();

  for (const r of rows) {
    const wf = (r.workflow_status as string) ?? "draft";
    if (wf === "published" || wf === "locked") publishedCount += 1;
    if (r.is_absent) {
      absentCount += 1;
      continue;
    }
    if (r.marks_obtained == null || r.max_marks == null) continue;
    const pct = percent(Number(r.marks_obtained), Number(r.max_marks));
    if (pct == null) continue;
    sumPct += pct;
    scored += 1;
    passEligible += 1;
    if (pct >= ANALYTICS_THRESHOLDS.passPercent) passCount += 1;

    const sid = r.subject_id as string;
    const bucket = bySubjectMap.get(sid) ?? { percents: [], points: [] };
    bucket.percents.push(pct);
    bucket.points.push({
      key: r.id as string,
      label: examMap.get(r.exam_definition_id as string) ?? "Exam",
      value: pct,
      meta: {
        examDefinitionId: r.exam_definition_id,
        marks: r.marks_obtained,
        max: r.max_marks,
      },
    });
    bySubjectMap.set(sid, bucket);

    const eid = (r.exam_definition_id as string) ?? "unknown";
    const eb = examBuckets.get(eid) ?? { sum: 0, n: 0 };
    eb.sum += pct;
    eb.n += 1;
    examBuckets.set(eid, eb);
  }

  const bySubject: SubjectTrend[] = [...bySubjectMap.entries()].map(
    ([subjectId, b]) => {
      const avg =
        b.percents.length === 0
          ? null
          : round2(
              b.percents.reduce((a, c) => a + c, 0) / b.percents.length,
            );
      let trendDelta: number | null = null;
      if (b.percents.length >= 2) {
        const mid = Math.floor(b.percents.length / 2);
        const earlier = b.percents.slice(0, mid);
        const later = b.percents.slice(mid);
        const avgE =
          earlier.reduce((a, c) => a + c, 0) / Math.max(earlier.length, 1);
        const avgL =
          later.reduce((a, c) => a + c, 0) / Math.max(later.length, 1);
        trendDelta = round2(avgL - avgE);
      }
      return {
        subjectId,
        subjectName: subjectMap.get(subjectId) ?? null,
        averagePercent: avg,
        resultCount: b.percents.length,
        trendDelta,
        points: b.points,
      };
    },
  );

  const byExam: ProgressPoint[] = [...examBuckets.entries()].map(
    ([examId, b]) => ({
      key: examId,
      label: examMap.get(examId) ?? examId,
      value: b.n === 0 ? null : round2(b.sum / b.n),
      meta: { resultCount: b.n },
    }),
  );

  return {
    totalResults: rows.length,
    publishedCount,
    absentCount,
    overallAveragePercent: scored === 0 ? null : round2(sumPct / scored),
    passRate: passEligible === 0 ? null : round2(passCount / passEligible),
    bySubject,
    byExam,
  };
}

async function aggregateParticipation(
  supabase: Supabase,
  schoolId: string,
  input: { studentProfileId: string; academicYearId: string },
): Promise<ParticipationAggregate> {
  const { data } = await supabase
    .from("event_participants")
    .select(
      "id, calendar_event_id, participation_role, attendance_status, award_label, position_label",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .is("archived_at", null)
    .limit(500);

  // Filter by year via calendar_events when possible
  const rows = data ?? [];
  const eventIds = [
    ...new Set(rows.map((r) => r.calendar_event_id as string).filter(Boolean)),
  ];
  let yearEventIds = new Set<string>();
  if (eventIds.length) {
    const { data: events } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("school_id", schoolId)
      .eq("academic_year_id", input.academicYearId)
      .in("id", eventIds);
    yearEventIds = new Set((events ?? []).map((e) => e.id as string));
  }

  const scoped = rows.filter((r) =>
    yearEventIds.size
      ? yearEventIds.has(r.calendar_event_id as string)
      : true,
  );

  const roles: Record<string, number> = {};
  let attendedCount = 0;
  let awardCount = 0;
  for (const r of scoped) {
    const role = (r.participation_role as string) ?? "participant";
    roles[role] = (roles[role] ?? 0) + 1;
    if (
      r.attendance_status === "present" ||
      r.attendance_status === "attended"
    ) {
      attendedCount += 1;
    }
    if (r.award_label || r.position_label) awardCount += 1;
  }

  return {
    eventCount: scoped.length,
    attendedCount,
    awardCount,
    roles,
  };
}

async function aggregateBehaviour(
  supabase: Supabase,
  schoolId: string,
  input: { studentProfileId: string; academicYearId: string },
  visibleOnly: boolean,
): Promise<BehaviourAggregate> {
  let query = supabase
    .from("conduct_incidents")
    .select(
      "remark_kind, severity, follow_up_status, title, recorded_at, visibility",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .eq("student_profile_id", input.studentProfileId)
    .is("archived_at", null)
    .is("superseded_at", null)
    .limit(1000);

  if (visibleOnly) {
    query = query.or(
      "visible_to_guardians.eq.true,visible_to_students.eq.true",
    );
  }

  const { data } = await query;
  const rows = data ?? [];
  const byKind: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  let positiveCount = 0;
  let disciplinaryCount = 0;
  let openFollowUps = 0;

  for (const r of rows) {
    const kind = (r.remark_kind as string) ?? "other";
    byKind[kind] = (byKind[kind] ?? 0) + 1;
    const sev = (r.severity as string) ?? "low";
    bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;
    if (kind === "positive" || kind === "commendation") positiveCount += 1;
    if (kind === "disciplinary" || kind === "warning") disciplinaryCount += 1;
    if (
      r.follow_up_status === "pending" ||
      r.follow_up_status === "in_progress"
    ) {
      openFollowUps += 1;
    }
  }

  return {
    total: rows.length,
    byKind,
    bySeverity,
    positiveCount,
    disciplinaryCount,
    openFollowUps,
  };
}

async function loadAchievements(
  supabase: Supabase,
  schoolId: string,
  input: { studentProfileId: string; academicYearId: string },
): Promise<AchievementItem[]> {
  const items: AchievementItem[] = [];

  const { data: parts } = await supabase
    .from("event_participants")
    .select(
      "id, award_label, position_label, calendar_event_id, updated_at",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .is("archived_at", null)
    .limit(200);

  for (const p of parts ?? []) {
    if (!p.award_label && !p.position_label) continue;
    items.push({
      source: "event_award",
      title: [p.position_label, p.award_label].filter(Boolean).join(" — "),
      occurredOn: (p.updated_at as string)?.slice(0, 10) ?? null,
      refId: p.id as string,
    });
  }

  const { data: commendations } = await supabase
    .from("conduct_incidents")
    .select("id, title, recorded_at, remark_kind")
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .eq("student_profile_id", input.studentProfileId)
    .in("remark_kind", ["commendation", "positive"])
    .is("archived_at", null)
    .is("superseded_at", null)
    .limit(100);

  for (const c of commendations ?? []) {
    items.push({
      source: "conduct_commendation",
      title: (c.title as string) ?? "Commendation",
      occurredOn: (c.recorded_at as string)?.slice(0, 10) ?? null,
      refId: c.id as string,
    });
  }

  return items;
}

async function loadTeacherRemarks(
  supabase: Supabase,
  schoolId: string,
  input: { studentProfileId: string; academicYearId: string },
  visibleOnly: boolean,
): Promise<TeacherRemarkItem[]> {
  const items: TeacherRemarkItem[] = [];

  let marksQuery = supabase
    .from("exam_results")
    .select(
      "id, teacher_remark, published_at, created_at, subject_id, workflow_status",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .eq("student_profile_id", input.studentProfileId)
    .is("superseded_at", null)
    .not("teacher_remark", "is", null)
    .limit(100);

  if (visibleOnly) {
    marksQuery = marksQuery.in("workflow_status", ["published", "locked"]);
  }

  const { data: marks } = await marksQuery;
  for (const m of marks ?? []) {
    if (!(m.teacher_remark as string)?.trim()) continue;
    items.push({
      source: "assessment",
      title: "Assessment remark",
      body: m.teacher_remark as string,
      occurredOn:
        ((m.published_at ?? m.created_at) as string)?.slice(0, 10) ?? null,
      refId: m.id as string,
      visibility: null,
    });
  }

  let behQuery = supabase
    .from("conduct_incidents")
    .select("id, title, body, recorded_at, visibility, remark_kind")
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .eq("student_profile_id", input.studentProfileId)
    .is("archived_at", null)
    .is("superseded_at", null)
    .limit(100);

  if (visibleOnly) {
    behQuery = behQuery.or(
      "visible_to_guardians.eq.true,visible_to_students.eq.true",
    );
  }

  const { data: remarks } = await behQuery;
  for (const r of remarks ?? []) {
    items.push({
      source: "behaviour",
      title: (r.title as string) ?? (r.remark_kind as string) ?? "Remark",
      body: (r.body as string) ?? null,
      occurredOn: (r.recorded_at as string)?.slice(0, 10) ?? null,
      refId: r.id as string,
      visibility: (r.visibility as string) ?? null,
    });
  }

  const { data: hw } = await supabase
    .from("homework_submissions")
    .select(
      "id, teacher_feedback, graded_at, homework_id, updated_at",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .is("archived_at", null)
    .not("teacher_feedback", "is", null)
    .limit(100);

  for (const h of hw ?? []) {
    if (!(h.teacher_feedback as string)?.trim()) continue;
    items.push({
      source: "homework",
      title: "Homework feedback",
      body: h.teacher_feedback as string,
      occurredOn:
        ((h.graded_at ?? h.updated_at) as string)?.slice(0, 10) ?? null,
      refId: h.id as string,
      visibility: null,
    });
  }

  return items;
}
