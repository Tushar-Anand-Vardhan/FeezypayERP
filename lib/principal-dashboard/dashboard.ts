import {
  PRINCIPAL_DASHBOARD_PANELS,
  dayOfWeekFromDate,
  parseAsOfDate,
  toIsoDate,
} from "@/lib/principal-dashboard/catalog";
import {
  percent,
  resolveActiveYearId,
  round2,
} from "@/lib/principal-dashboard/server-helpers";
import type {
  DepartmentPerformanceRow,
  NotificationRow,
  PendingApprovalRow,
  PendingAssessmentRow,
  PendingReportCardRow,
  PrincipalDashboardAggregate,
  PrincipalPanel,
  PrincipalPanelId,
  SchoolAttendanceSummary,
  SchoolHealthIndicator,
  SchoolHealthSummary,
  StudentPerformanceSummary,
  TeacherAttendanceSummary,
  UpcomingEventRow,
} from "@/lib/principal-dashboard/types";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function panelDef(id: PrincipalPanelId) {
  const found = PRINCIPAL_DASHBOARD_PANELS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown panel ${id}`);
  return found;
}

function wrap<T>(
  id: PrincipalPanelId,
  items: T,
  empty: boolean,
): PrincipalPanel<T> {
  const def = panelDef(id);
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    sourceTables: def.sourceTables,
    empty,
    items,
  };
}

export async function buildPrincipalDashboard(
  supabase: Supabase,
  schoolId: string,
  schoolName: string | null,
  input?: { asOfDate?: string; academicYearId?: string },
): Promise<PrincipalDashboardAggregate> {
  const asOf = parseAsOfDate(input?.asOfDate);
  const asOfDate = toIsoDate(asOf);
  const dayOfWeek = dayOfWeekFromDate(asOf);
  const academicYearId =
    input?.academicYearId ?? (await resolveActiveYearId(supabase, schoolId));

  const [
    schoolAttendance,
    teacherAttendance,
    studentPerformance,
    departmentPerformance,
    upcomingEvents,
    pendingApprovals,
    pendingReportCards,
    pendingAssessments,
    notifications,
  ] = await Promise.all([
    loadSchoolAttendance(supabase, schoolId, academicYearId, asOfDate),
    loadTeacherAttendance(
      supabase,
      schoolId,
      academicYearId,
      asOfDate,
      dayOfWeek,
    ),
    loadStudentPerformance(supabase, schoolId, academicYearId),
    loadDepartmentPerformance(supabase, schoolId, academicYearId),
    loadUpcomingEvents(supabase, schoolId, academicYearId, asOfDate),
    loadPendingApprovals(supabase, schoolId, academicYearId),
    loadPendingReportCards(supabase, schoolId, academicYearId),
    loadPendingAssessments(supabase, schoolId, academicYearId),
    loadNotifications(supabase, schoolId),
  ]);

  const schoolHealth = buildSchoolHealth({
    schoolAttendance,
    teacherAttendance,
    studentPerformance,
    pendingApprovals,
    pendingReportCards,
    pendingAssessments,
  });

  return {
    schoolId,
    schoolName,
    asOfDate,
    academicYearId,
    generatedAt: new Date().toISOString(),
    panels: {
      school_attendance: wrap(
        "school_attendance",
        schoolAttendance,
        schoolAttendance.totalRecords === 0 &&
          schoolAttendance.sectionsWithSessionsToday === 0,
      ),
      teacher_attendance: wrap(
        "teacher_attendance",
        teacherAttendance,
        teacherAttendance.activeEmployments === 0,
      ),
      student_performance: wrap(
        "student_performance",
        studentPerformance,
        studentPerformance.publishedResultCount === 0,
      ),
      department_performance: wrap(
        "department_performance",
        departmentPerformance,
        departmentPerformance.length === 0,
      ),
      upcoming_events: wrap(
        "upcoming_events",
        upcomingEvents,
        upcomingEvents.length === 0,
      ),
      pending_approvals: wrap(
        "pending_approvals",
        pendingApprovals,
        pendingApprovals.length === 0,
      ),
      pending_report_cards: wrap(
        "pending_report_cards",
        pendingReportCards,
        pendingReportCards.length === 0,
      ),
      pending_assessments: wrap(
        "pending_assessments",
        pendingAssessments,
        pendingAssessments.length === 0,
      ),
      notifications: wrap(
        "notifications",
        notifications,
        notifications.length === 0,
      ),
      school_health: wrap(
        "school_health",
        schoolHealth,
        schoolHealth.indicators.length === 0,
      ),
    },
  };
}

async function loadSchoolAttendance(
  supabase: Supabase,
  schoolId: string,
  academicYearId: string | null,
  asOfDate: string,
): Promise<SchoolAttendanceSummary> {
  let recordsQuery = supabase
    .from("attendance_records")
    .select("status, section_id")
    .eq("school_id", schoolId)
    .eq("attendance_date", asOfDate)
    .is("superseded_at", null)
    .eq("is_correction", false)
    .limit(5000);

  if (academicYearId) {
    recordsQuery = recordsQuery.eq("academic_year_id", academicYearId);
  }

  const { data: records } = await recordsQuery;
  const byStatus: Record<string, number> = {};
  for (const r of records ?? []) {
    const st = (r.status as string) ?? "unknown";
    byStatus[st] = (byStatus[st] ?? 0) + 1;
  }
  const total = records?.length ?? 0;
  const presentish =
    (byStatus.present ?? 0) + (byStatus.late ?? 0) + (byStatus.half_day ?? 0);

  let sessionsQuery = supabase
    .from("attendance_sessions")
    .select("id, section_id, workflow_status")
    .eq("school_id", schoolId)
    .eq("attendance_date", asOfDate)
    .limit(500);
  if (academicYearId) {
    sessionsQuery = sessionsQuery.eq("academic_year_id", academicYearId);
  }
  const { data: sessions } = await sessionsQuery;
  const sectionsWithSessionsToday = new Set(
    (sessions ?? []).map((s) => s.section_id as string),
  ).size;

  // Sections with any timetable slot today missing a completed session
  const dayOfWeek = dayOfWeekFromDate(new Date(`${asOfDate}T12:00:00.000Z`));
  const { data: slots } = await supabase
    .from("timetable_slots")
    .select("section_id")
    .eq("day_of_week", dayOfWeek)
    .is("archived_at", null)
    .limit(1000);
  const expectedSections = new Set(
    (slots ?? []).map((s) => s.section_id as string),
  );
  const completedSections = new Set(
    (sessions ?? [])
      .filter((s) =>
        ["submitted", "approved", "locked"].includes(
          s.workflow_status as string,
        ),
      )
      .map((s) => s.section_id as string),
  );
  let sectionsMissingToday = 0;
  for (const sid of expectedSections) {
    if (!completedSections.has(sid)) sectionsMissingToday += 1;
  }

  return {
    asOfDate,
    academicYearId,
    totalRecords: total,
    byStatus,
    presentRate: total === 0 ? null : round2(presentish / total),
    sectionsWithSessionsToday,
    sectionsMissingToday,
  };
}

async function loadTeacherAttendance(
  supabase: Supabase,
  schoolId: string,
  academicYearId: string | null,
  asOfDate: string,
  dayOfWeek: number,
): Promise<TeacherAttendanceSummary> {
  const { count: activeEmployments } = await supabase
    .from("teacher_employments")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("status", "active");

  const { data: slots } = await supabase
    .from("timetable_slots")
    .select("section_id, teacher_id")
    .eq("day_of_week", dayOfWeek)
    .is("archived_at", null)
    .not("teacher_id", "is", null)
    .limit(2000);

  // Filter slots to school sections when year known
  let expectedSectionIds = [
    ...new Set((slots ?? []).map((s) => s.section_id as string)),
  ];
  if (academicYearId && expectedSectionIds.length) {
    const { data: sections } = await supabase
      .from("sections")
      .select("id, classes!inner(academic_year_id)")
      .in("id", expectedSectionIds);
    const inYear = new Set(
      (sections ?? [])
        .filter((s) => {
          const classes = s.classes as
            | { academic_year_id?: string }
            | { academic_year_id?: string }[]
            | null;
          const row = Array.isArray(classes) ? classes[0] : classes;
          return row?.academic_year_id === academicYearId;
        })
        .map((s) => s.id as string),
    );
    expectedSectionIds = expectedSectionIds.filter((id) => inYear.has(id));
  }

  let sessionsQuery = supabase
    .from("attendance_sessions")
    .select("section_id, taken_by_employment_id, workflow_status")
    .eq("school_id", schoolId)
    .eq("attendance_date", asOfDate)
    .limit(500);
  if (academicYearId) {
    sessionsQuery = sessionsQuery.eq("academic_year_id", academicYearId);
  }
  const { data: sessions } = await sessionsQuery;

  const markedSections = new Set(
    (sessions ?? [])
      .filter((s) =>
        ["submitted", "approved", "locked"].includes(
          s.workflow_status as string,
        ),
      )
      .map((s) => s.section_id as string),
  );
  const teachersWhoMarked = new Set(
    (sessions ?? [])
      .map((s) => s.taken_by_employment_id as string | null)
      .filter(Boolean),
  );

  const expected = expectedSectionIds.length;
  const marked = expectedSectionIds.filter((id) => markedSections.has(id))
    .length;

  return {
    asOfDate,
    note: "Staff biometric attendance is FUTURE. This panel shows teacher attendance-marking completion for taught sections.",
    activeEmployments: activeEmployments ?? 0,
    teachersWhoMarkedToday: teachersWhoMarked.size,
    expectedSectionsToday: expected,
    sectionsMarkedToday: marked,
    markingCompletionRate: expected === 0 ? null : round2(marked / expected),
  };
}

async function loadStudentPerformance(
  supabase: Supabase,
  schoolId: string,
  academicYearId: string | null,
): Promise<StudentPerformanceSummary> {
  if (!academicYearId) {
    return {
      academicYearId: null,
      publishedResultCount: 0,
      averagePercent: null,
      passRate: null,
      bySubjectTop: [],
    };
  }

  const { data: results } = await supabase
    .from("exam_results")
    .select("subject_id, marks_obtained, max_marks, is_absent")
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .is("superseded_at", null)
    .in("workflow_status", ["published", "locked"])
    .limit(5000);

  const rows = results ?? [];
  let sum = 0;
  let scored = 0;
  let passEligible = 0;
  let passCount = 0;
  const bySubject = new Map<string, number[]>();

  for (const r of rows) {
    if (r.is_absent) continue;
    if (r.marks_obtained == null || r.max_marks == null) continue;
    const pct = percent(Number(r.marks_obtained), Number(r.max_marks));
    if (pct == null) continue;
    sum += pct;
    scored += 1;
    passEligible += 1;
    if (pct >= 33) passCount += 1;
    const sid = r.subject_id as string;
    const arr = bySubject.get(sid) ?? [];
    arr.push(pct);
    bySubject.set(sid, arr);
  }

  const subjectIds = [...bySubject.keys()];
  const { data: subjects } = subjectIds.length
    ? await supabase.from("subjects").select("id, name").in("id", subjectIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const subjectMap = new Map((subjects ?? []).map((s) => [s.id, s.name]));

  const bySubjectTop = [...bySubject.entries()]
    .map(([subjectId, percents]) => ({
      subjectId,
      subjectName: subjectMap.get(subjectId) ?? null,
      averagePercent: round2(
        percents.reduce((a, c) => a + c, 0) / percents.length,
      ),
      resultCount: percents.length,
    }))
    .sort((a, b) => (b.averagePercent ?? 0) - (a.averagePercent ?? 0))
    .slice(0, 8);

  return {
    academicYearId,
    publishedResultCount: rows.length,
    averagePercent: scored === 0 ? null : round2(sum / scored),
    passRate: passEligible === 0 ? null : round2(passCount / passEligible),
    bySubjectTop,
  };
}

async function loadDepartmentPerformance(
  supabase: Supabase,
  schoolId: string,
  academicYearId: string | null,
): Promise<DepartmentPerformanceRow[]> {
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .limit(100);

  const rows: DepartmentPerformanceRow[] = [];
  for (const d of departments ?? []) {
    const { count: memberCount } = await supabase
      .from("department_memberships")
      .select("id", { count: "exact", head: true })
      .eq("department_id", d.id)
      .is("left_on", null);

    const { data: deptSubjects } = await supabase
      .from("department_subjects")
      .select("subject_id")
      .eq("department_id", d.id)
      .is("archived_at", null);

    const subjectIds = (deptSubjects ?? []).map((s) => s.subject_id as string);
    let averagePercent: number | null = null;
    let resultCount = 0;

    if (academicYearId && subjectIds.length) {
      const { data: results } = await supabase
        .from("exam_results")
        .select("marks_obtained, max_marks, is_absent")
        .eq("school_id", schoolId)
        .eq("academic_year_id", academicYearId)
        .in("subject_id", subjectIds)
        .is("superseded_at", null)
        .in("workflow_status", ["published", "locked"])
        .limit(2000);

      let sum = 0;
      let scored = 0;
      for (const r of results ?? []) {
        if (r.is_absent) continue;
        if (r.marks_obtained == null || r.max_marks == null) continue;
        const pct = percent(Number(r.marks_obtained), Number(r.max_marks));
        if (pct == null) continue;
        sum += pct;
        scored += 1;
      }
      resultCount = results?.length ?? 0;
      averagePercent = scored === 0 ? null : round2(sum / scored);
    }

    rows.push({
      departmentId: d.id as string,
      departmentName: d.name as string,
      memberCount: memberCount ?? 0,
      subjectCount: subjectIds.length,
      averagePercent,
      resultCount,
    });
  }

  return rows.sort((a, b) => a.departmentName.localeCompare(b.departmentName));
}

async function loadUpcomingEvents(
  supabase: Supabase,
  schoolId: string,
  academicYearId: string | null,
  asOfDate: string,
): Promise<UpcomingEventRow[]> {
  let query = supabase
    .from("calendar_events")
    .select(
      "id, title, category, starts_at, ends_at, location, approval_status",
    )
    .eq("school_id", schoolId)
    .gte("starts_at", `${asOfDate}T00:00:00.000Z`)
    .in("approval_status", ["approved", "published"])
    .is("archived_at", null)
    .order("starts_at", { ascending: true })
    .limit(20);

  if (academicYearId) {
    query = query.eq("academic_year_id", academicYearId);
  }

  const { data } = await query;
  return (data ?? []).map((e) => ({
    id: e.id as string,
    title: e.title as string,
    category: e.category as string,
    startsAt: e.starts_at as string,
    endsAt: e.ends_at as string,
    location: (e.location as string) ?? null,
    approvalStatus: e.approval_status as string,
  }));
}

async function loadPendingApprovals(
  supabase: Supabase,
  schoolId: string,
  academicYearId: string | null,
): Promise<PendingApprovalRow[]> {
  const items: PendingApprovalRow[] = [];

  let eventsQuery = supabase
    .from("calendar_events")
    .select("id, title, approval_status, created_at")
    .eq("school_id", schoolId)
    .eq("approval_status", "pending")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (academicYearId) {
    eventsQuery = eventsQuery.eq("academic_year_id", academicYearId);
  }
  const { data: events } = await eventsQuery;
  for (const e of events ?? []) {
    items.push({
      kind: "calendar_event",
      id: e.id as string,
      title: e.title as string,
      status: e.approval_status as string,
      createdAt: (e.created_at as string) ?? null,
      hrefHint: "/dashboard/calendar",
    });
  }

  const { data: leaves } = await supabase
    .from("attendance_leave_requests")
    .select("id, status, created_at, start_date, end_date, student_profile_id")
    .eq("school_id", schoolId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);
  for (const l of leaves ?? []) {
    items.push({
      kind: "leave_request",
      id: l.id as string,
      title: `Leave ${l.start_date} → ${l.end_date}`,
      status: l.status as string,
      createdAt: (l.created_at as string) ?? null,
      hrefHint: "/dashboard",
    });
  }

  if (academicYearId) {
    const { data: conduct } = await supabase
      .from("conduct_incidents")
      .select("id, title, status, severity, recorded_at")
      .eq("school_id", schoolId)
      .eq("academic_year_id", academicYearId)
      .in("severity", ["high", "critical"])
      .in("status", ["open", "under_review"])
      .is("archived_at", null)
      .is("superseded_at", null)
      .order("recorded_at", { ascending: false })
      .limit(20);
    for (const c of conduct ?? []) {
      items.push({
        kind: "conduct_incident",
        id: c.id as string,
        title: (c.title as string) ?? "Conduct incident",
        status: `${c.status}/${c.severity}`,
        createdAt: (c.recorded_at as string) ?? null,
        hrefHint: "/dashboard",
      });
    }

    const { data: sessions } = await supabase
      .from("assessment_mark_sessions")
      .select("id, workflow_status, exam_definition_id, subject_id, created_at")
      .eq("school_id", schoolId)
      .eq("academic_year_id", academicYearId)
      .eq("workflow_status", "draft")
      .order("created_at", { ascending: false })
      .limit(20);
    for (const s of sessions ?? []) {
      items.push({
        kind: "mark_session",
        id: s.id as string,
        title: "Draft mark session",
        status: s.workflow_status as string,
        createdAt: (s.created_at as string) ?? null,
        hrefHint: "/dashboard",
      });
    }
  }

  return items;
}

async function loadPendingReportCards(
  supabase: Supabase,
  schoolId: string,
  academicYearId: string | null,
): Promise<PendingReportCardRow[]> {
  let query = supabase
    .from("report_card_issues")
    .select(
      "id, title, status, student_profile_id, academic_year_id, updated_at",
    )
    .eq("school_id", schoolId)
    .eq("status", "draft")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (academicYearId) {
    query = query.eq("academic_year_id", academicYearId);
  }

  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    status: r.status as string,
    studentProfileId: r.student_profile_id as string,
    academicYearId: r.academic_year_id as string,
    updatedAt: r.updated_at as string,
  }));
}

async function loadPendingAssessments(
  supabase: Supabase,
  schoolId: string,
  academicYearId: string | null,
): Promise<PendingAssessmentRow[]> {
  const items: PendingAssessmentRow[] = [];
  if (!academicYearId) return items;

  const { data: drafts } = await supabase
    .from("assessment_mark_sessions")
    .select("id, workflow_status, subject_id, section_id, exam_definition_id")
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .eq("workflow_status", "draft")
    .limit(30);

  for (const d of drafts ?? []) {
    items.push({
      kind: "mark_session_draft",
      id: d.id as string,
      title: "Draft mark session",
      status: d.workflow_status as string,
      subjectId: (d.subject_id as string) ?? null,
      sectionId: (d.section_id as string) ?? null,
    });
  }

  const { data: exams } = await supabase
    .from("exam_definitions")
    .select("id, name, publishing_status")
    .eq("school_id", schoolId)
    .eq("publishing_status", "published")
    .is("archived_at", null)
    .limit(30);

  for (const e of exams ?? []) {
    const { count } = await supabase
      .from("exam_results")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("exam_definition_id", e.id)
      .is("superseded_at", null);
    if ((count ?? 0) === 0) {
      items.push({
        kind: "exam_awaiting_results",
        id: e.id as string,
        title: (e.name as string) ?? "Published exam",
        status: e.publishing_status as string,
        subjectId: null,
        sectionId: null,
      });
    }
  }

  return items;
}

async function loadNotifications(
  supabase: Supabase,
  schoolId: string,
): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from("notification_delivery_requests")
    .select(
      "id, title, channel, status, notification_type_code, created_at, read_at",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(30);

  return (data ?? []).map((n) => ({
    id: n.id as string,
    title: n.title as string,
    channel: n.channel as string,
    status: n.status as string,
    notificationTypeCode: n.notification_type_code as string,
    createdAt: n.created_at as string,
    readAt: (n.read_at as string) ?? null,
  }));
}

function buildSchoolHealth(input: {
  schoolAttendance: SchoolAttendanceSummary;
  teacherAttendance: TeacherAttendanceSummary;
  studentPerformance: StudentPerformanceSummary;
  pendingApprovals: PendingApprovalRow[];
  pendingReportCards: PendingReportCardRow[];
  pendingAssessments: PendingAssessmentRow[];
}): SchoolHealthSummary {
  const indicators: SchoolHealthIndicator[] = [];

  const att = input.schoolAttendance.presentRate;
  indicators.push({
    code: "attendance.present_rate",
    label: "Student attendance",
    status:
      att == null
        ? "unknown"
        : att >= 0.9
          ? "healthy"
          : att >= 0.75
            ? "watch"
            : "critical",
    value: att == null ? null : round2(att * 100),
    detail:
      att == null
        ? "No attendance records for as-of date."
        : `Present rate ${(att * 100).toFixed(1)}% today.`,
    evidence: {
      presentRate: att,
      totalRecords: input.schoolAttendance.totalRecords,
      sectionsMissingToday: input.schoolAttendance.sectionsMissingToday,
    },
  });

  const mark = input.teacherAttendance.markingCompletionRate;
  indicators.push({
    code: "teacher.marking_completion",
    label: "Teacher marking completion",
    status:
      mark == null
        ? "unknown"
        : mark >= 0.85
          ? "healthy"
          : mark >= 0.6
            ? "watch"
            : "critical",
    value: mark == null ? null : round2(mark * 100),
    detail:
      mark == null
        ? "No taught sections scheduled today."
        : `${input.teacherAttendance.sectionsMarkedToday}/${input.teacherAttendance.expectedSectionsToday} sections marked.`,
    evidence: {
      markingCompletionRate: mark,
      teachersWhoMarkedToday: input.teacherAttendance.teachersWhoMarkedToday,
    },
  });

  const perf = input.studentPerformance.averagePercent;
  indicators.push({
    code: "assessment.average",
    label: "Student performance",
    status:
      perf == null
        ? "unknown"
        : perf >= 70
          ? "healthy"
          : perf >= 50
            ? "watch"
            : "critical",
    value: perf,
    detail:
      perf == null
        ? "No published results yet."
        : `School average ${perf.toFixed(1)}% across published results.`,
    evidence: {
      averagePercent: perf,
      publishedResultCount: input.studentPerformance.publishedResultCount,
    },
  });

  const approvals = input.pendingApprovals.length;
  indicators.push({
    code: "ops.pending_approvals",
    label: "Pending approvals",
    status:
      approvals === 0 ? "healthy" : approvals <= 5 ? "watch" : "critical",
    value: approvals,
    detail: `${approvals} item(s) awaiting principal/admin attention.`,
    evidence: { count: approvals },
  });

  const cards = input.pendingReportCards.length;
  indicators.push({
    code: "ops.pending_report_cards",
    label: "Pending report cards",
    status: cards === 0 ? "healthy" : cards <= 10 ? "watch" : "critical",
    value: cards,
    detail: `${cards} draft report card(s).`,
    evidence: { count: cards },
  });

  const assess = input.pendingAssessments.length;
  indicators.push({
    code: "ops.pending_assessments",
    label: "Pending assessments",
    status: assess === 0 ? "healthy" : assess <= 8 ? "watch" : "critical",
    value: assess,
    detail: `${assess} draft session(s) / exam(s) awaiting results.`,
    evidence: { count: assess },
  });

  const ranks = { healthy: 0, watch: 1, critical: 2, unknown: 0 };
  let worst: SchoolHealthSummary["overall"] = "healthy";
  for (const ind of indicators) {
    if (ranks[ind.status] > ranks[worst]) {
      worst = ind.status === "unknown" ? worst : ind.status;
    }
  }
  if (indicators.every((i) => i.status === "unknown")) {
    worst = "unknown";
  }

  return { overall: worst, indicators };
}
