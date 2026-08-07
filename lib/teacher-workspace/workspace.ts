import type { createClient } from "@/lib/supabase/server";
import {
  TEACHER_AI_SHORTCUT_PLACEHOLDERS,
  TEACHER_WORKSPACE_PANELS,
  dayOfWeekFromDate,
  toIsoDate,
} from "@/lib/teacher-workspace/catalog";
import {
  departmentIdsForEmployment,
  getEmploymentInSchool,
} from "@/lib/teacher-workspace/server-helpers";
import type {
  AnnouncementRow,
  ClassReminderRow,
  HomeworkRow,
  PendingAssessmentRow,
  PendingAttendanceRow,
  TeacherWorkspaceAggregate,
  TeacherWorkspacePanel,
  TeacherWorkspacePanelId,
  TimetablePeriodRow,
  UpcomingEventRow,
} from "@/lib/teacher-workspace/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function panelDef(id: TeacherWorkspacePanelId) {
  const found = TEACHER_WORKSPACE_PANELS.find((p) => p.id === id);
  if (!found) {
    throw new Error(`Unknown panel ${id}`);
  }
  return found;
}

function wrap<T>(
  id: TeacherWorkspacePanelId,
  items: T,
): TeacherWorkspacePanel<T> {
  const def = panelDef(id);
  const empty = Array.isArray(items) ? items.length === 0 : items == null;
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    sourceTables: def.sourceTables,
    empty,
    items,
  };
}

async function loadActiveYearId(
  supabase: Supabase,
  schoolId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .is("archived_at", null)
    .maybeSingle();
  return data?.id ?? null;
}

async function loadTodaysSlots(
  supabase: Supabase,
  schoolId: string,
  employmentId: string,
  dayOfWeek: number,
  yearId: string | null,
): Promise<{
  rows: TimetablePeriodRow[];
  sectionIds: string[];
  subjectIds: string[];
}> {
  let slotQuery = supabase
    .from("timetable_slots")
    .select(
      "id, day_of_week, period_definition_id, section_id, subject_id, room_id, teacher_id",
    )
    .eq("teacher_id", employmentId)
    .eq("day_of_week", dayOfWeek)
    .is("archived_at", null);

  const { data: slots } = await slotQuery;
  if (!slots?.length) {
    return { rows: [], sectionIds: [], subjectIds: [] };
  }

  // Restrict to sections in active year when known
  let filtered = slots;
  if (yearId) {
    const sectionIdsAll = [...new Set(slots.map((s) => s.section_id))];
    const { data: sections } = await supabase
      .from("sections")
      .select("id, class_id, name, classes!inner(academic_year_id, name)")
      .in("id", sectionIdsAll);

    const inYear = new Set(
      (sections ?? [])
        .filter((s) => {
          const classes = s.classes as
            | { academic_year_id?: string; name?: string }
            | { academic_year_id?: string; name?: string }[]
            | null;
          const row = Array.isArray(classes) ? classes[0] : classes;
          return row?.academic_year_id === yearId;
        })
        .map((s) => s.id),
    );
    filtered = slots.filter((s) => inYear.has(s.section_id));
  }

  const sectionIds = [...new Set(filtered.map((s) => s.section_id))];
  const periodIds = [
    ...new Set(filtered.map((s) => s.period_definition_id)),
  ];
  const subjectIds = [
    ...new Set(
      filtered.map((s) => s.subject_id).filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: sections }, { data: periods }, { data: subjects }] =
    await Promise.all([
      sectionIds.length
        ? supabase
            .from("sections")
            .select("id, name, class_id, classes(name)")
            .in("id", sectionIds)
        : Promise.resolve({ data: [] as never[] }),
      periodIds.length
        ? supabase
            .from("period_definitions")
            .select("id, period_number, start_time, end_time")
            .in("id", periodIds)
        : Promise.resolve({ data: [] as never[] }),
      subjectIds.length
        ? supabase
            .from("subjects")
            .select("id, name")
            .eq("school_id", schoolId)
            .in("id", subjectIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);

  const sectionMap = new Map(
    (sections ?? []).map((s) => {
      const classes = s.classes as
        | { name?: string }
        | { name?: string }[]
        | null;
      const classRow = Array.isArray(classes) ? classes[0] : classes;
      return [
        s.id,
        {
          sectionName: s.name as string,
          className: classRow?.name ?? null,
        },
      ];
    }),
  );
  const periodMap = new Map(
    (periods ?? []).map((p) => [
      p.id,
      {
        periodNumber: p.period_number as number,
        startTime: p.start_time as string,
        endTime: p.end_time as string,
      },
    ]),
  );
  const subjectMap = new Map(
    (subjects ?? []).map((s) => [s.id, s.name as string]),
  );

  const rows: TimetablePeriodRow[] = filtered
    .map((s) => {
      const sec = sectionMap.get(s.section_id);
      const per = periodMap.get(s.period_definition_id);
      return {
        slotId: s.id,
        dayOfWeek: s.day_of_week,
        periodDefinitionId: s.period_definition_id,
        periodNumber: per?.periodNumber ?? null,
        startTime: per?.startTime ?? null,
        endTime: per?.endTime ?? null,
        sectionId: s.section_id,
        sectionName: sec?.sectionName ?? null,
        className: sec?.className ?? null,
        subjectId: s.subject_id,
        subjectName: s.subject_id
          ? (subjectMap.get(s.subject_id) ?? null)
          : null,
        roomId: s.room_id,
      };
    })
    .sort((a, b) => {
      const an = a.periodNumber ?? 99;
      const bn = b.periodNumber ?? 99;
      if (an !== bn) return an - bn;
      return (a.startTime ?? "").localeCompare(b.startTime ?? "");
    });

  return {
    rows,
    sectionIds: [...new Set(rows.map((r) => r.sectionId))],
    subjectIds: [
      ...new Set(
        rows
          .map((r) => r.subjectId)
          .filter((id): id is string => Boolean(id)),
      ),
    ],
  };
}

async function loadPendingAttendance(
  supabase: Supabase,
  schoolId: string,
  asOfDate: string,
  timetable: TimetablePeriodRow[],
): Promise<PendingAttendanceRow[]> {
  const sectionIds = [...new Set(timetable.map((t) => t.sectionId))];
  if (sectionIds.length === 0) {
    return [];
  }

  const { data: marked } = await supabase
    .from("attendance_records")
    .select("section_id")
    .eq("school_id", schoolId)
    .eq("attendance_date", asOfDate)
    .in("section_id", sectionIds);

  const markedSet = new Set(
    (marked ?? [])
      .map((m) => m.section_id)
      .filter((id): id is string => Boolean(id)),
  );

  const pending: PendingAttendanceRow[] = [];
  for (const sectionId of sectionIds) {
    if (markedSet.has(sectionId)) continue;
    const sample = timetable.find((t) => t.sectionId === sectionId);
    pending.push({
      sectionId,
      sectionName: sample?.sectionName ?? null,
      className: sample?.className ?? null,
      attendanceDate: asOfDate,
      reason: "No attendance_records for this section on the as-of date.",
    });
  }
  return pending;
}

async function loadPendingAssessments(
  supabase: Supabase,
  schoolId: string,
  employmentId: string,
  yearId: string | null,
  taughtSubjectIdsFromSlots: string[],
): Promise<PendingAssessmentRow[]> {
  const { data: eligibility } = await supabase
    .from("employment_subjects")
    .select("subject_id")
    .eq("employment_id", employmentId);

  const subjectIds = [
    ...new Set([
      ...taughtSubjectIdsFromSlots,
      ...(eligibility ?? []).map((e) => e.subject_id),
    ]),
  ];
  if (subjectIds.length === 0 || !yearId) {
    return [];
  }

  const { data: exams } = await supabase
    .from("exam_definitions")
    .select("id, name, publishing_status, academic_year_id")
    .eq("academic_year_id", yearId)
    .in("publishing_status", ["published", "locked"])
    .is("archived_at", null);

  if (!exams?.length) {
    return [];
  }

  const examIds = exams.map((e) => e.id);
  const { data: schedules } = await supabase
    .from("exam_subject_schedules")
    .select("id, exam_definition_id, subject_id, class_id")
    .in("exam_definition_id", examIds)
    .in("subject_id", subjectIds)
    .is("archived_at", null);

  if (!schedules?.length) {
    return [];
  }

  const { data: results } = await supabase
    .from("exam_results")
    .select("exam_definition_id, subject_id")
    .eq("school_id", schoolId)
    .in(
      "exam_definition_id",
      schedules.map((s) => s.exam_definition_id),
    );

  const resultKey = new Set(
    (results ?? []).map((r) => `${r.exam_definition_id}:${r.subject_id}`),
  );

  const classIds = [...new Set(schedules.map((s) => s.class_id))];
  const [{ data: classes }, { data: subjects }] = await Promise.all([
    classIds.length
      ? supabase.from("classes").select("id, name").in("id", classIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    supabase
      .from("subjects")
      .select("id, name")
      .eq("school_id", schoolId)
      .in("id", subjectIds),
  ]);

  const classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const subjectMap = new Map((subjects ?? []).map((s) => [s.id, s.name]));
  const examMap = new Map(exams.map((e) => [e.id, e]));

  const pending: PendingAssessmentRow[] = [];
  for (const schedule of schedules) {
    const key = `${schedule.exam_definition_id}:${schedule.subject_id}`;
    if (resultKey.has(key)) continue;
    const exam = examMap.get(schedule.exam_definition_id);
    if (!exam) continue;
    pending.push({
      examDefinitionId: exam.id,
      examName: exam.name,
      subjectId: schedule.subject_id,
      subjectName: subjectMap.get(schedule.subject_id) ?? null,
      classId: schedule.class_id,
      className: classMap.get(schedule.class_id) ?? null,
      scheduleId: schedule.id,
      publishingStatus: exam.publishing_status,
    });
  }
  return pending;
}

async function loadHomework(
  supabase: Supabase,
  schoolId: string,
  employmentId: string,
): Promise<HomeworkRow[]> {
  const { data } = await supabase
    .from("homework_assignments")
    .select(
      "id, title, section_id, subject_id, assigned_on, due_on, status",
    )
    .eq("school_id", schoolId)
    .eq("employment_id", employmentId)
    .in("status", ["assigned", "draft"])
    .is("archived_at", null)
    .order("due_on", { ascending: true });

  return (data ?? []).map((h) => ({
    id: h.id,
    title: h.title,
    sectionId: h.section_id,
    subjectId: h.subject_id,
    assignedOn: h.assigned_on,
    dueOn: h.due_on,
    status: h.status,
  }));
}

async function loadAnnouncements(
  supabase: Supabase,
  schoolId: string,
): Promise<AnnouncementRow[]> {
  const { data: depts } = await supabase
    .from("departments")
    .select("id, name")
    .eq("school_id", schoolId)
    .is("archived_at", null);

  const deptIds = (depts ?? []).map((d) => d.id);
  if (deptIds.length === 0) {
    return [];
  }

  const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));
  const { data } = await supabase
    .from("department_announcements")
    .select(
      "id, department_id, title, body, visibility, published_at, status",
    )
    .in("department_id", deptIds)
    .eq("status", "published")
    .in("visibility", ["staff", "school"])
    .is("archived_at", null)
    .order("published_at", { ascending: false })
    .limit(30);

  return (data ?? []).map((a) => ({
    id: a.id,
    departmentId: a.department_id,
    departmentName: deptMap.get(a.department_id) ?? null,
    title: a.title,
    body: a.body,
    visibility: a.visibility,
    publishedAt: a.published_at,
  }));
}

async function loadDepartmentNotices(
  supabase: Supabase,
  schoolId: string,
  departmentIds: string[],
): Promise<AnnouncementRow[]> {
  if (departmentIds.length === 0) {
    return [];
  }

  const { data: depts } = await supabase
    .from("departments")
    .select("id, name")
    .eq("school_id", schoolId)
    .in("id", departmentIds);

  const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));
  const { data } = await supabase
    .from("department_announcements")
    .select(
      "id, department_id, title, body, visibility, published_at",
    )
    .in("department_id", departmentIds)
    .eq("status", "published")
    .eq("visibility", "department")
    .is("archived_at", null)
    .order("published_at", { ascending: false })
    .limit(30);

  return (data ?? []).map((a) => ({
    id: a.id,
    departmentId: a.department_id,
    departmentName: deptMap.get(a.department_id) ?? null,
    title: a.title,
    body: a.body,
    visibility: a.visibility,
    publishedAt: a.published_at,
  }));
}

async function loadUpcomingEvents(
  supabase: Supabase,
  schoolId: string,
  yearId: string | null,
  asOfDate: string,
): Promise<UpcomingEventRow[]> {
  if (!yearId) {
    return [];
  }

  const startIso = `${asOfDate}T00:00:00.000Z`;
  const { data } = await supabase
    .from("calendar_events")
    .select(
      "id, title, category, starts_at, ends_at, location, approval_status",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", yearId)
    .gte("starts_at", startIso)
    .in("approval_status", ["approved", "published"])
    .is("archived_at", null)
    .order("starts_at", { ascending: true })
    .limit(20);

  return (data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    location: e.location,
    approvalStatus: e.approval_status,
  }));
}

function buildClassReminders(
  timetable: TimetablePeriodRow[],
  events: UpcomingEventRow[],
  now: Date,
): ClassReminderRow[] {
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;
  const reminders: ClassReminderRow[] = [];

  for (const period of timetable) {
    if (period.startTime && period.startTime < nowTime) {
      continue;
    }
    reminders.push({
      kind: "period",
      id: period.slotId,
      title: [
        period.className,
        period.sectionName,
        period.subjectName,
      ]
        .filter(Boolean)
        .join(" · "),
      whenLabel: period.startTime
        ? `Period ${period.periodNumber ?? "?"} at ${period.startTime.slice(0, 5)}`
        : `Period ${period.periodNumber ?? "?"}`,
      sectionId: period.sectionId,
      startsAt: period.startTime,
    });
  }

  for (const event of events.slice(0, 5)) {
    reminders.push({
      kind: "event",
      id: event.id,
      title: event.title,
      whenLabel: event.startsAt,
      startsAt: event.startsAt,
    });
  }

  return reminders;
}

export async function buildTeacherWorkspace(
  supabase: Supabase,
  schoolId: string,
  employmentId: string,
  asOf: Date = new Date(),
): Promise<TeacherWorkspaceAggregate | null> {
  const employment = await getEmploymentInSchool(
    supabase,
    schoolId,
    employmentId,
  );
  if (!employment) {
    return null;
  }

  const asOfDate = toIsoDate(asOf);
  const dayOfWeek = dayOfWeekFromDate(asOf);
  const yearId = await loadActiveYearId(supabase, schoolId);
  const deptIds = await departmentIdsForEmployment(
    supabase,
    employmentId,
    employment.departmentId,
  );

  const { rows: timetable, subjectIds } = await loadTodaysSlots(
    supabase,
    schoolId,
    employmentId,
    dayOfWeek,
    yearId,
  );

  const [
    pendingAttendance,
    pendingAssessments,
    homework,
    announcements,
    upcomingEvents,
    departmentNotices,
  ] = await Promise.all([
    loadPendingAttendance(supabase, schoolId, asOfDate, timetable),
    loadPendingAssessments(
      supabase,
      schoolId,
      employmentId,
      yearId,
      subjectIds,
    ),
    loadHomework(supabase, schoolId, employmentId),
    loadAnnouncements(supabase, schoolId),
    loadUpcomingEvents(supabase, schoolId, yearId, asOfDate),
    loadDepartmentNotices(supabase, schoolId, deptIds),
  ]);

  const classReminders = buildClassReminders(
    timetable,
    upcomingEvents,
    asOf,
  );

  const panels: TeacherWorkspaceAggregate["panels"] = {
    todays_timetable: wrap("todays_timetable", timetable),
    pending_attendance: wrap("pending_attendance", pendingAttendance),
    pending_assessments: wrap("pending_assessments", pendingAssessments),
    homework: wrap("homework", homework),
    announcements: wrap("announcements", announcements),
    upcoming_events: wrap("upcoming_events", upcomingEvents),
    class_reminders: wrap("class_reminders", classReminders),
    department_notices: wrap("department_notices", departmentNotices),
    ai_shortcuts: {
      ...panelDef("ai_shortcuts"),
      empty: false,
      items: TEACHER_AI_SHORTCUT_PLACEHOLDERS,
    },
  };

  return {
    schoolId,
    employmentId,
    asOfDate,
    dayOfWeek,
    employment,
    generatedAt: new Date().toISOString(),
    panels,
  };
}
