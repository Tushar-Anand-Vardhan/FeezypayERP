import type { createClient } from "@/lib/supabase/server";
import type {
  ReportCardPresentationSnapshot,
  ReportCardSourceRefs,
} from "@/lib/report-cards/ops-types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Assemble a report card from owning engines.
 * Does not insert/copy exam_results — only reads and records source_refs.
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
      "id, name, status, include_grades, include_remarks, include_attendance, include_co_curricular, include_teacher_comments, include_principal_comments",
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

  // --- Assessments (E11) — read only ---
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

  const assessments = (results ?? []).map((r) => ({
    examResultId: r.id as string,
    examDefinitionId: r.exam_definition_id as string,
    examName: examMap.get(r.exam_definition_id) ?? null,
    subjectId: r.subject_id as string,
    subjectName: subjectMap.get(r.subject_id) ?? null,
    marksObtained:
      r.marks_obtained == null ? null : Number(r.marks_obtained),
    maxMarks: r.max_marks == null ? null : Number(r.max_marks),
    gradeLabel: (r.grade_label as string | null) ?? null,
    isAbsent: Boolean(r.is_absent),
    teacherRemark: (r.teacher_remark as string | null) ?? null,
    workflowStatus: (r.workflow_status as string | null) ?? null,
  }));

  const teacherRemarksFromAssessments = assessments
    .map((a) => a.teacherRemark)
    .filter((t): t is string => Boolean(t?.trim()));

  // --- Attendance (E12) — aggregate derived ---
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

  // --- Co-curricular (E07) ---
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

  const houseIds = [...new Set((houseMemberships ?? []).map((h) => h.house_id))];
  const { data: houses } = houseIds.length
    ? await supabase
        .from("houses")
        .select("id, name")
        .in("id", houseIds)
        .eq("school_id", input.schoolId)
    : { data: [] as Array<{ id: string; name: string }> };
  const houseMap = new Map((houses ?? []).map((h) => [h.id, h.name]));

  let clubQuery = supabase
    .from("club_memberships")
    .select("id, club_id, role, academic_year_id, left_on")
    .eq("student_profile_id", input.studentProfileId)
    .is("left_on", null)
    .limit(50);
  // academic_year_id may be null on older rows
  const { data: clubMemberships } = await clubQuery;

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

  // --- Behaviour (E13 stub reads) ---
  const { data: incidents } = await supabase
    .from("conduct_incidents")
    .select("id, occurred_on, severity, category, title, status")
    .eq("school_id", input.schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .eq("academic_year_id", input.academicYearId)
    .is("archived_at", null)
    .order("occurred_on", { ascending: false })
    .limit(50);

  const generatedAt = new Date().toISOString();
  const promotionStatus =
    (placement?.promotion_status as string | null) ?? null;

  const sourceRefs: ReportCardSourceRefs = {
    examResultIds: assessments.map((a) => a.examResultId),
    examDefinitionIds: [
      ...new Set(assessments.map((a) => a.examDefinitionId)),
    ],
    attendanceRecordIds: (attendanceRows ?? []).map((r) => r.id as string),
    conductIncidentIds: (incidents ?? []).map((i) => i.id as string),
    houseMembershipIds: (houseMemberships ?? []).map((h) => h.id as string),
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
    promotionStatus,
  };

  return { sourceRefs, presentation };
}
