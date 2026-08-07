import type { createClient } from "@/lib/supabase/server";
import type {
  ReportCardPresentationSnapshot,
  ReportCardSourceRefs,
} from "@/lib/report-cards/ops-types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Assemble a report card from owning engines.
 * Never inserts/copies marks OLTP — only reads and records source_refs.
 * Prefer published E33 grade results when template.prefer_grade_calculation.
 */
export async function assembleReportCardFromSources(
  supabase: Supabase,
  input: {
    schoolId: string;
    studentProfileId: string;
    academicYearId: string;
    templateId: string;
    termId?: string | null;
    teacherRemarks?: string | null;
    principalRemarks?: string | null;
    fieldValues?: Record<string, string | null>;
  },
): Promise<
  | {
      sourceRefs: ReportCardSourceRefs;
      presentation: ReportCardPresentationSnapshot;
    }
  | { error: string }
> {
  const { data: template } = await supabase
    .from("report_card_templates")
    .select(
      "id, name, status, include_grades, include_remarks, include_attendance, include_co_curricular, include_teacher_comments, include_principal_comments, include_achievements, include_behaviour, include_curriculum, include_observations, include_promotion, prefer_grade_calculation",
    )
    .eq("id", input.templateId)
    .eq("school_id", input.schoolId)
    .is("archived_at", null)
    .maybeSingle();

  if (!template) {
    return { error: "Template not found." };
  }
  if (template.status !== "published" && template.status !== "retired") {
    return {
      error: "Template must be published (or retired) before generating cards.",
    };
  }

  const preferGc = template.prefer_grade_calculation !== false;

  const { data: templateVersion } = await supabase
    .from("report_card_template_versions")
    .select("id, version")
    .eq("template_id", input.templateId)
    .eq("is_immutable", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: bindings } = await supabase
    .from("report_card_template_assessments")
    .select("exam_definition_id, display_label, display_order, archived_at")
    .eq("template_id", input.templateId)
    .is("archived_at", null)
    .order("display_order", { ascending: true });

  const boundExamIds = (bindings ?? []).map((b) => b.exam_definition_id);

  const { data: admission } = await supabase
    .from("student_admissions")
    .select("id, admission_number, student_profile_id")
    .eq("school_id", input.schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .maybeSingle();

  if (!admission) {
    return { error: "Student admission not found in this school." };
  }

  const { data: profile } = await supabase
    .from("student_profiles")
    .select("id, person_id, global_id")
    .eq("id", input.studentProfileId)
    .maybeSingle();

  let fullName: string | null = null;
  if (profile?.person_id) {
    const { data: person } = await supabase
      .from("persons")
      .select("full_name")
      .eq("id", profile.person_id)
      .maybeSingle();
    fullName = person?.full_name ?? null;
  }

  const { data: placement } = await supabase
    .from("student_academic_years")
    .select(
      "id, class_id, section_id, roll_number, status, promotion_status",
    )
    .eq("admission_id", admission.id)
    .eq("academic_year_id", input.academicYearId)
    .eq("status", "active")
    .is("left_on", null)
    .maybeSingle();

  let className: string | null = null;
  let sectionName: string | null = null;
  if (placement?.class_id) {
    const { data: klass } = await supabase
      .from("classes")
      .select("id, name")
      .eq("id", placement.class_id)
      .maybeSingle();
    className = klass?.name ?? null;
  }
  if (placement?.section_id) {
    const { data: section } = await supabase
      .from("sections")
      .select("id, name")
      .eq("id", placement.section_id)
      .maybeSingle();
    sectionName = section?.name ?? null;
  }

  // --- Grades: prefer E33 published results ---
  const assessments: ReportCardPresentationSnapshot["assessments"] = [];
  const gradeCalculationRunIds: string[] = [];
  const gradeCalculationResultIds: string[] = [];
  let gradeSummary: ReportCardPresentationSnapshot["gradeSummary"] = {
    subjectResults: [],
    termResult: null,
    overallResult: null,
  };

  if (template.include_grades !== false && preferGc && placement?.class_id) {
    let runsQuery = supabase
      .from("grade_calculation_runs")
      .select("id, scope, term_id, subject_id, status, is_current")
      .eq("school_id", input.schoolId)
      .eq("academic_year_id", input.academicYearId)
      .eq("class_id", placement.class_id)
      .eq("status", "published")
      .eq("is_current", true);

    if (input.termId) {
      runsQuery = runsQuery.or(`term_id.eq.${input.termId},term_id.is.null`);
    }

    const { data: runs } = await runsQuery.limit(50);
    const runIds = (runs ?? []).map((r) => r.id as string);
    gradeCalculationRunIds.push(...runIds);

    if (runIds.length) {
      const { data: gcResults } = await supabase
        .from("grade_calculation_results")
        .select(
          "id, run_id, student_profile_id, subject_id, result_kind, final_marks, max_marks, percentage, letter_grade, grade_points, pass_status, is_current",
        )
        .in("run_id", runIds)
        .eq("student_profile_id", input.studentProfileId)
        .eq("is_current", true)
        .limit(200);

      const subjectIds = [
        ...new Set(
          (gcResults ?? [])
            .map((r) => r.subject_id as string | null)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const { data: subjects } = subjectIds.length
        ? await supabase
            .from("subjects")
            .select("id, name")
            .in("id", subjectIds)
            .eq("school_id", input.schoolId)
        : { data: [] as Array<{ id: string; name: string }> };
      const subjectMap = new Map((subjects ?? []).map((s) => [s.id, s.name]));

      for (const r of gcResults ?? []) {
        gradeCalculationResultIds.push(r.id as string);
        const subjectId = (r.subject_id as string | null) ?? null;
        const row = {
          source: "grade_calculation" as const,
          resultId: r.id as string,
          subjectId,
          subjectName: subjectId ? (subjectMap.get(subjectId) ?? null) : null,
          marksObtained:
            r.final_marks == null ? null : Number(r.final_marks),
          maxMarks: r.max_marks == null ? null : Number(r.max_marks),
          percentage:
            r.percentage == null ? null : Number(r.percentage),
          gradeLabel: (r.letter_grade as string | null) ?? null,
          gradePoints:
            r.grade_points == null ? null : Number(r.grade_points),
          passStatus: (r.pass_status as string | null) ?? null,
          resultKind: (r.result_kind as string | null) ?? null,
          isAbsent: false,
          teacherRemark: null,
          workflowStatus: "published",
        };
        assessments.push(row);

        if (r.result_kind === "subject") {
          gradeSummary.subjectResults.push({
            resultId: r.id as string,
            subjectId,
            subjectName: row.subjectName,
            percentage: row.percentage,
            letterGrade: row.gradeLabel,
            gradePoints: row.gradePoints,
            passStatus: row.passStatus,
          });
        } else if (r.result_kind === "term" && !gradeSummary.termResult) {
          gradeSummary.termResult = {
            resultId: r.id as string,
            percentage: row.percentage,
            letterGrade: row.gradeLabel,
            gradePoints: row.gradePoints,
            passStatus: row.passStatus,
          };
        } else if (
          r.result_kind === "overall" &&
          !gradeSummary.overallResult
        ) {
          gradeSummary.overallResult = {
            resultId: r.id as string,
            percentage: row.percentage,
            letterGrade: row.gradeLabel,
            gradePoints: row.gradePoints,
            passStatus: row.passStatus,
          };
        }
      }
    }
  }

  // --- E11 fallback when no E33 results ---
  const examResultIds: string[] = [];
  const examDefinitionIds: string[] = [];
  if (template.include_grades !== false && assessments.length === 0) {
    let resultsQuery = supabase
      .from("exam_results")
      .select(
        "id, exam_definition_id, subject_id, marks_obtained, max_marks, grade_label, is_absent, teacher_remark, workflow_status",
      )
      .eq("school_id", input.schoolId)
      .eq("student_profile_id", input.studentProfileId)
      .eq("academic_year_id", input.academicYearId)
      .is("superseded_at", null)
      .in("workflow_status", ["published", "locked"]);

    if (boundExamIds.length) {
      resultsQuery = resultsQuery.in("exam_definition_id", boundExamIds);
    }

    const { data: results } = await resultsQuery.limit(500);
    const examIds = [
      ...new Set((results ?? []).map((r) => r.exam_definition_id)),
    ];
    const subjectIds = [...new Set((results ?? []).map((r) => r.subject_id))];

    const [{ data: exams }, { data: subjects }] = await Promise.all([
      examIds.length
        ? supabase.from("exam_definitions").select("id, name").in("id", examIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      subjectIds.length
        ? supabase
            .from("subjects")
            .select("id, name")
            .in("id", subjectIds)
            .eq("school_id", input.schoolId)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ]);

    const examMap = new Map((exams ?? []).map((e) => [e.id, e.name]));
    const subjectMap = new Map((subjects ?? []).map((s) => [s.id, s.name]));

    for (const r of results ?? []) {
      examResultIds.push(r.id as string);
      examDefinitionIds.push(r.exam_definition_id as string);
      const marks =
        r.marks_obtained == null ? null : Number(r.marks_obtained);
      const max = r.max_marks == null ? null : Number(r.max_marks);
      assessments.push({
        source: "exam_result",
        resultId: r.id as string,
        examResultId: r.id as string,
        examDefinitionId: r.exam_definition_id as string,
        examName: examMap.get(r.exam_definition_id) ?? null,
        subjectId: r.subject_id as string,
        subjectName: subjectMap.get(r.subject_id) ?? null,
        marksObtained: marks,
        maxMarks: max,
        percentage:
          marks != null && max != null && max > 0
            ? Math.round((marks / max) * 10000) / 100
            : null,
        gradeLabel: (r.grade_label as string | null) ?? null,
        gradePoints: null,
        passStatus: null,
        isAbsent: Boolean(r.is_absent),
        teacherRemark: (r.teacher_remark as string | null) ?? null,
        workflowStatus: (r.workflow_status as string | null) ?? null,
      });
    }
  }

  const teacherRemarksFromAssessments = assessments
    .map((a) => a.teacherRemark)
    .filter((t): t is string => Boolean(t?.trim()));

  // --- Attendance (E12) ---
  const { data: attendanceRows } = await supabase
    .from("attendance_records")
    .select("id, status")
    .eq("school_id", input.schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .eq("academic_year_id", input.academicYearId)
    .is("superseded_at", null)
    .in("workflow_status", ["approved", "locked"])
    .limit(4000);

  const byStatus: Record<string, number> = {};
  for (const row of attendanceRows ?? []) {
    const s = (row.status as string) ?? "unknown";
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }
  const totalAtt = attendanceRows?.length ?? 0;
  const presentish =
    (byStatus.present ?? 0) + (byStatus.late ?? 0) + (byStatus.half_day ?? 0);
  const presentRate =
    totalAtt > 0 ? Math.round((presentish / totalAtt) * 10000) / 100 : null;

  // --- Co-curricular ---
  const { data: houseMembershipsAll } = await supabase
    .from("house_memberships")
    .select("id, house_id, role, academic_year_id")
    .eq("student_profile_id", input.studentProfileId)
    .is("left_on", null)
    .limit(20);

  const houseMemberships = (houseMembershipsAll ?? []).filter(
    (h) =>
      !h.academic_year_id || h.academic_year_id === input.academicYearId,
  );
  const houseIds = [...new Set(houseMemberships.map((h) => h.house_id))];
  const { data: houses } = houseIds.length
    ? await supabase
        .from("houses")
        .select("id, name")
        .in("id", houseIds)
        .eq("school_id", input.schoolId)
    : { data: [] as Array<{ id: string; name: string }> };
  const houseMap = new Map((houses ?? []).map((h) => [h.id, h.name]));

  const { data: clubMemberships } = await supabase
    .from("club_memberships")
    .select("id, club_id, role, academic_year_id, left_on")
    .eq("student_profile_id", input.studentProfileId)
    .is("left_on", null)
    .limit(50);

  const clubRows = (clubMemberships ?? []).filter(
    (c) =>
      !c.academic_year_id || c.academic_year_id === input.academicYearId,
  );
  const clubIds = [...new Set(clubRows.map((c) => c.club_id))];
  const { data: clubs } = clubIds.length
    ? await supabase
        .from("clubs")
        .select("id, name")
        .in("id", clubIds)
        .eq("school_id", input.schoolId)
    : { data: [] as Array<{ id: string; name: string }> };
  const clubMap = new Map((clubs ?? []).map((c) => [c.id, c.name]));

  // --- Behaviour ---
  const { data: incidents } =
    template.include_behaviour === false
      ? { data: [] as Array<Record<string, unknown>> }
      : await supabase
          .from("conduct_incidents")
          .select("id, occurred_on, severity, category, title, status")
          .eq("school_id", input.schoolId)
          .eq("student_profile_id", input.studentProfileId)
          .eq("academic_year_id", input.academicYearId)
          .is("archived_at", null)
          .order("occurred_on", { ascending: false })
          .limit(50);

  // --- Achievements ---
  const { data: achievements } =
    template.include_achievements === false
      ? { data: [] as Array<Record<string, unknown>> }
      : await supabase
          .from("student_achievements")
          .select(
            "id, title, category, awarded_on, description, academic_year_id, award_label, position_label, points, participation_role",
          )
          .eq("school_id", input.schoolId)
          .eq("student_profile_id", input.studentProfileId)
          .is("archived_at", null)
          .order("awarded_on", { ascending: false })
          .limit(50);

  const achievementRows = (achievements ?? []).filter(
    (a) =>
      !a.academic_year_id || a.academic_year_id === input.academicYearId,
  );

  // --- Curriculum completion (section aggregate — not per-student SoT) ---
  let curriculumCompletion: ReportCardPresentationSnapshot["curriculumCompletion"] =
    {
      sectionId: placement?.section_id ?? null,
      totalNodes: 0,
      completedNodes: 0,
      completionPct: null,
      progressIds: [],
    };

  if (
    template.include_curriculum !== false &&
    placement?.section_id
  ) {
    const { data: progress } = await supabase
      .from("curriculum_topic_progress")
      .select("id, status, completion_pct")
      .eq("section_id", placement.section_id)
      .limit(2000);

    const progressIds = (progress ?? []).map((p) => p.id as string);
    const totalNodes = progress?.length ?? 0;
    const completedNodes = (progress ?? []).filter(
      (p) => p.status === "completed",
    ).length;
    const completionPct =
      totalNodes > 0
        ? Math.round((completedNodes / totalNodes) * 10000) / 100
        : null;
    curriculumCompletion = {
      sectionId: placement.section_id,
      totalNodes,
      completedNodes,
      completionPct,
      progressIds,
    };
  }

  // --- Observations: prefer E34 student_observations; E32 fallback ---
  const observations: ReportCardPresentationSnapshot["observations"] = [];
  const observationRecordIds: string[] = [];

  if (template.include_observations !== false) {
    let obsQuery = supabase
      .from("student_observations")
      .select(
        "id, category_id, category_code, subject_id, observed_on, remark, visibility",
      )
      .eq("school_id", input.schoolId)
      .eq("student_profile_id", input.studentProfileId)
      .eq("academic_year_id", input.academicYearId)
      .is("archived_at", null)
      .in("visibility", ["parent_visible", "school", "staff"])
      .order("observed_on", { ascending: false })
      .limit(100);

    if (input.termId) {
      obsQuery = obsQuery.or(`term_id.eq.${input.termId},term_id.is.null`);
    }

    const { data: e34Rows } = await obsQuery;

    if (e34Rows?.length) {
      const subjectIds = [
        ...new Set(
          e34Rows
            .map((r) => r.subject_id as string | null)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const { data: subjects } = subjectIds.length
        ? await supabase
            .from("subjects")
            .select("id, name")
            .in("id", subjectIds)
        : { data: [] as Array<{ id: string; name: string }> };
      const subjectMap = new Map((subjects ?? []).map((s) => [s.id, s.name]));

      for (const r of e34Rows) {
        observationRecordIds.push(r.id as string);
        const subjectId = (r.subject_id as string | null) ?? null;
        observations.push({
          recordId: r.id as string,
          categoryId: (r.category_id as string | null) ?? null,
          categoryName: (r.category_code as string | null) ?? null,
          subjectId,
          subjectName: subjectId
            ? (subjectMap.get(subjectId) ?? null)
            : null,
          title: (r.category_code as string | null) ?? null,
          recordedOn: (r.observed_on as string | null) ?? null,
          summary: (r.remark as string | null) ?? null,
        });
      }
    } else {
      // Fallback: E32 locked records under observation-kind categories
      const { data: obsCategories } = await supabase
        .from("assessment_framework_categories")
        .select("id, name, kind")
        .eq("kind", "observation")
        .is("archived_at", null)
        .limit(100);

      const obsCategoryIds = (obsCategories ?? []).map((c) => c.id as string);
      const catMap = new Map(
        (obsCategories ?? []).map((c) => [c.id as string, c.name as string]),
      );

      if (obsCategoryIds.length) {
        let recordsQuery = supabase
          .from("assessment_records")
          .select(
            "id, framework_category_id, subject_id, title, conducted_on, description, status, section_id",
          )
          .eq("school_id", input.schoolId)
          .eq("academic_year_id", input.academicYearId)
          .in("framework_category_id", obsCategoryIds)
          .eq("status", "locked")
          .is("archived_at", null);

        if (placement?.section_id) {
          recordsQuery = recordsQuery.eq("section_id", placement.section_id);
        }

        const { data: records } = await recordsQuery.limit(100);

        const subjectIds = [
          ...new Set(
            (records ?? [])
              .map((r) => r.subject_id as string | null)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const { data: subjects } = subjectIds.length
          ? await supabase
              .from("subjects")
              .select("id, name")
              .in("id", subjectIds)
          : { data: [] as Array<{ id: string; name: string }> };
        const subjectMap = new Map(
          (subjects ?? []).map((s) => [s.id, s.name]),
        );

        for (const r of records ?? []) {
          observationRecordIds.push(r.id as string);
          const subjectId = (r.subject_id as string | null) ?? null;
          const categoryId = r.framework_category_id as string;
          observations.push({
            recordId: r.id as string,
            categoryId,
            categoryName: catMap.get(categoryId) ?? null,
            subjectId,
            subjectName: subjectId
              ? (subjectMap.get(subjectId) ?? null)
              : null,
            title: (r.title as string | null) ?? null,
            recordedOn: (r.conducted_on as string | null) ?? null,
            summary: (r.description as string | null) ?? null,
          });
        }
      }
    }
  }

  const generatedAt = new Date().toISOString();
  const promotionStatus =
    template.include_promotion === false
      ? null
      : ((placement?.promotion_status as string | null) ?? null);

  const sourceRefs: ReportCardSourceRefs = {
    examResultIds,
    examDefinitionIds: [...new Set(examDefinitionIds)],
    gradeCalculationRunIds,
    gradeCalculationResultIds,
    attendanceRecordIds: (attendanceRows ?? []).map((r) => r.id as string),
    conductIncidentIds: (incidents ?? []).map((i) => i.id as string),
    achievementIds: achievementRows.map((a) => a.id as string),
    observationRecordIds,
    curriculumProgressIds: curriculumCompletion.progressIds,
    houseMembershipIds: houseMemberships.map((h) => h.id as string),
    clubMembershipIds: clubRows.map((c) => c.id as string),
    studentAcademicYearId: placement?.id ?? null,
    templateId: input.templateId,
    templateVersionId: templateVersion?.id ?? null,
    academicYearId: input.academicYearId,
    termId: input.termId ?? null,
  };

  const presentation: ReportCardPresentationSnapshot = {
    generatedAt,
    student: {
      studentProfileId: input.studentProfileId,
      personId: profile?.person_id ?? null,
      fullName,
      admissionNumber: admission.admission_number ?? null,
      globalId: profile?.global_id ?? null,
    },
    placement: {
      studentAcademicYearId: placement?.id ?? null,
      classId: placement?.class_id ?? null,
      className,
      sectionId: placement?.section_id ?? null,
      sectionName,
      rollNumber: placement?.roll_number ?? null,
      promotionStatus,
      enrollmentStatus: (placement?.status as string | null) ?? null,
    },
    template: {
      templateId: input.templateId,
      templateName: template.name ?? null,
      templateVersionId: templateVersion?.id ?? null,
      templateVersion: templateVersion?.version ?? null,
    },
    assessments: template.include_grades === false ? [] : assessments,
    gradeSummary:
      template.include_grades === false
        ? { subjectResults: [], termResult: null, overallResult: null }
        : gradeSummary,
    attendance:
      template.include_attendance === false
        ? { totalRecords: 0, byStatus: {}, presentRate: null }
        : {
            totalRecords: totalAtt,
            byStatus,
            presentRate,
          },
    teacherRemarksFromAssessments:
      template.include_remarks === false ||
      template.include_teacher_comments === false
        ? []
        : teacherRemarksFromAssessments,
    teacherRemarks: input.teacherRemarks ?? null,
    principalRemarks: input.principalRemarks ?? null,
    fieldValues: input.fieldValues ?? {},
    coCurricular:
      template.include_co_curricular === false
        ? { houses: [], clubs: [] }
        : {
            houses: houseMemberships.map((h) => ({
              membershipId: h.id as string,
              houseId: h.house_id as string,
              houseName: houseMap.get(h.house_id) ?? null,
              role: (h.role as string | null) ?? null,
            })),
            clubs: clubRows.map((c) => ({
              membershipId: c.id as string,
              clubId: c.club_id as string,
              clubName: clubMap.get(c.club_id) ?? null,
              role: (c.role as string | null) ?? null,
            })),
          },
    behaviour: (incidents ?? []).map((i) => ({
      incidentId: i.id as string,
      occurredOn: i.occurred_on as string,
      severity: i.severity as string,
      category: i.category as string,
      title: i.title as string,
      status: i.status as string,
    })),
    achievements: achievementRows.map((a) => ({
      achievementId: a.id as string,
      title: a.title as string,
      category: (a.category as string | null) ?? null,
      awardedOn: (a.awarded_on as string | null) ?? null,
      description: (a.description as string | null) ?? null,
      awardLabel: (a.award_label as string | null) ?? null,
      positionLabel: (a.position_label as string | null) ?? null,
      points: a.points == null ? null : Number(a.points),
      participationRole: (a.participation_role as string | null) ?? null,
    })),
    curriculumCompletion:
      template.include_curriculum === false
        ? {
            sectionId: null,
            totalNodes: 0,
            completedNodes: 0,
            completionPct: null,
            progressIds: [],
          }
        : curriculumCompletion,
    observations:
      template.include_observations === false ? [] : observations,
    promotionStatus,
  };

  return { sourceRefs, presentation };
}
