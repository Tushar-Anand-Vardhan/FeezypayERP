import type { createClient } from "@/lib/supabase/server";
import { STUDENT_PROFILE_MODULES } from "@/lib/student-profile/catalog";
import { resolveActivePlacement } from "@/lib/student-profile/server-helpers";
import type {
  AcademicHistoryRow,
  AiSummaryData,
  AssessmentModuleData,
  ClubMembershipRow,
  HouseMembershipRow,
  MedicalData,
  ParentLinkRow,
  PersonalInformationData,
  StudentProfileModuleId,
  StudentProfileModulePayload,
} from "@/lib/student-profile/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function def(id: StudentProfileModuleId) {
  const found = STUDENT_PROFILE_MODULES.find((m) => m.id === id);
  if (!found) {
    throw new Error(`Unknown student profile module: ${id}`);
  }
  return found;
}

export async function loadPersonal(
  supabase: Supabase,
  studentProfileId: string,
  personId: string,
  studentGlobalId: string,
): Promise<StudentProfileModulePayload<PersonalInformationData>> {
  const meta = def("personal");
  const { data: person } = await supabase
    .from("persons")
    .select(
      "id, global_id, full_name, first_name, last_name, date_of_birth, gender, email, phone, aadhaar_last4, photo_path, address, profile_completed_at",
    )
    .eq("id", personId)
    .maybeSingle();

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "live",
    data: {
      studentProfileId,
      personId,
      studentGlobalId,
      personGlobalId: person?.global_id ?? "",
      fullName: person?.full_name ?? "",
      firstName: person?.first_name ?? null,
      lastName: person?.last_name ?? null,
      dateOfBirth: person?.date_of_birth ?? null,
      gender: person?.gender ?? null,
      email: person?.email ?? null,
      phone: person?.phone ?? null,
      aadhaarLast4: person?.aadhaar_last4 ?? null,
      photoPath: person?.photo_path ?? null,
      address: person?.address ?? null,
      profileCompletedAt: person?.profile_completed_at ?? null,
    },
  };
}

export async function loadAdmission(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<StudentProfileModulePayload<AdmissionDataLike>> {
  const meta = def("admission");
  const { data } = await supabase
    .from("student_admissions")
    .select(
      "id, admission_number, status, admitted_on, exited_on, house_id",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .order("admitted_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "live",
    note: data?.house_id
      ? "admission.house_id is a legacy pointer; house module uses house_memberships."
      : undefined,
    data: data
      ? {
          admissionId: data.id,
          admissionNumber: data.admission_number,
          status: data.status,
          admittedOn: data.admitted_on,
          exitedOn: data.exited_on,
          houseIdPointer: data.house_id,
        }
      : null,
  };
}

type AdmissionDataLike = {
  admissionId: string;
  admissionNumber: string;
  status: string;
  admittedOn: string;
  exitedOn: string | null;
  houseIdPointer: string | null;
} | null;

export async function loadAcademicHistory(
  supabase: Supabase,
  admissionId: string,
): Promise<StudentProfileModulePayload<AcademicHistoryRow[]>> {
  const meta = def("academic_history");
  const { data: rows } = await supabase
    .from("student_academic_years")
    .select(
      "id, academic_year_id, class_id, section_id, roll_number, enrolled_on, left_on, status, promotion_status, enrollment_type",
    )
    .eq("admission_id", admissionId)
    .order("enrolled_on", { ascending: false });

  const yearIds = [...new Set((rows ?? []).map((r) => r.academic_year_id))];
  const classIds = [...new Set((rows ?? []).map((r) => r.class_id))];
  const sectionIds = [...new Set((rows ?? []).map((r) => r.section_id))];

  const [{ data: years }, { data: classes }, { data: sections }] =
    await Promise.all([
      yearIds.length
        ? supabase.from("academic_years").select("id, label").in("id", yearIds)
        : Promise.resolve({ data: [] as Array<{ id: string; label: string }> }),
      classIds.length
        ? supabase.from("classes").select("id, name").in("id", classIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      sectionIds.length
        ? supabase.from("sections").select("id, name").in("id", sectionIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ]);

  const yearMap = new Map((years ?? []).map((y) => [y.id, y.label]));
  const classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const sectionMap = new Map((sections ?? []).map((s) => [s.id, s.name]));

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "live",
    data: (rows ?? []).map((r) => ({
      id: r.id,
      academicYearId: r.academic_year_id,
      academicYearLabel: yearMap.get(r.academic_year_id) ?? null,
      classId: r.class_id,
      className: classMap.get(r.class_id) ?? null,
      sectionId: r.section_id,
      sectionName: sectionMap.get(r.section_id) ?? null,
      rollNumber: r.roll_number,
      enrolledOn: r.enrolled_on,
      leftOn: r.left_on,
      status: r.status,
      promotionStatus: r.promotion_status,
      enrollmentType: r.enrollment_type,
    })),
  };
}

export async function loadAttendance(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<StudentProfileModulePayload<unknown[]>> {
  const meta = def("attendance");
  const { data } = await supabase
    .from("attendance_records")
    .select(
      "id, attendance_date, status, section_id, period_definition_id, notes, academic_year_id, workflow_status, visible_to_guardians, visible_to_students, late_minutes, leave_type",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .is("superseded_at", null)
    .order("attendance_date", { ascending: false })
    .limit(200);

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "live",
    note: "E12 Attendance Engine — approved/locked rows set visible_to_guardians/students.",
    data: data ?? [],
  };
}

export async function loadAssessments(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
  admissionId: string,
): Promise<StudentProfileModulePayload<AssessmentModuleData>> {
  const meta = def("assessments");
  const placement = await resolveActivePlacement(supabase, admissionId);

  let classSchedules: AssessmentModuleData["classSchedules"] = [];
  if (placement) {
    const { data: schedules } = await supabase
      .from("exam_subject_schedules")
      .select(
        "id, exam_definition_id, subject_id, grading_type, max_marks",
      )
      .eq("class_id", placement.classId)
      .is("archived_at", null);

    const examIds = [
      ...new Set((schedules ?? []).map((s) => s.exam_definition_id)),
    ];
    const subjectIds = [...new Set((schedules ?? []).map((s) => s.subject_id))];

    const [{ data: exams }, { data: subjects }] = await Promise.all([
      examIds.length
        ? supabase
            .from("exam_definitions")
            .select("id, name")
            .in("id", examIds)
            .is("archived_at", null)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      subjectIds.length
        ? supabase
            .from("subjects")
            .select("id, name")
            .in("id", subjectIds)
            .eq("school_id", schoolId)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ]);

    const examMap = new Map((exams ?? []).map((e) => [e.id, e.name]));
    const subjectMap = new Map((subjects ?? []).map((s) => [s.id, s.name]));

    classSchedules = (schedules ?? []).map((s) => ({
      scheduleId: s.id,
      examDefinitionId: s.exam_definition_id,
      examName: examMap.get(s.exam_definition_id) ?? null,
      subjectId: s.subject_id,
      subjectName: subjectMap.get(s.subject_id) ?? null,
      gradingType: s.grading_type,
      maxMarks: s.max_marks,
    }));
  }

  const { data: results } = await supabase
    .from("exam_results")
    .select(
      "id, exam_definition_id, subject_id, marks_obtained, max_marks, grade_label, is_absent, published_at, workflow_status, visible_to_guardians, teacher_remark",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .is("superseded_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "derived",
    note: "Schedules from E11 config; marks from E11 ops (publish/lock → visible).",
    data: {
      classSchedules,
      results: (results ?? []).map((r) => ({
        id: r.id,
        examDefinitionId: r.exam_definition_id,
        subjectId: r.subject_id,
        marksObtained: r.marks_obtained,
        maxMarks: r.max_marks,
        gradeLabel: r.grade_label,
        isAbsent: r.is_absent,
        publishedAt: r.published_at,
      })),
    },
  };
}

export async function loadReportCards(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
  admissionId: string,
): Promise<StudentProfileModulePayload<unknown>> {
  const meta = def("report_cards");
  const placement = await resolveActivePlacement(supabase, admissionId);

  let templates: Array<{ id: string; name: string; status: string }> = [];
  if (placement) {
    const { data: scopes } = await supabase
      .from("report_card_template_scopes")
      .select("template_id, class_id, section_id")
      .is("archived_at", null);

    const templateIds = [
      ...new Set(
        (scopes ?? [])
          .filter(
            (s) =>
              (s.class_id === null || s.class_id === placement.classId) &&
              (s.section_id === null || s.section_id === placement.sectionId),
          )
          .map((s) => s.template_id),
      ),
    ];

    if (templateIds.length) {
      const { data } = await supabase
        .from("report_card_templates")
        .select("id, name, status")
        .eq("school_id", schoolId)
        .in("id", templateIds)
        .is("archived_at", null);
      templates = data ?? [];
    }
  }

  const { data: issued } = await supabase
    .from("student_issued_documents")
    .select(
      "id, document_kind, title, status, issued_on, template_id, academic_year_id, media_path",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .is("archived_at", null)
    .order("issued_on", { ascending: false });

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "derived",
    note: "Templates are E20 config; issued PDF artifacts schema-ready.",
    data: { applicableTemplates: templates, issuedDocuments: issued ?? [] },
  };
}

export async function loadEvents(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
  admissionId: string,
): Promise<StudentProfileModulePayload<unknown>> {
  const meta = def("events");
  const placement = await resolveActivePlacement(supabase, admissionId);

  let yearEvents: unknown[] = [];
  if (placement) {
    const { data } = await supabase
      .from("calendar_events")
      .select(
        "id, title, category, starts_at, ends_at, approval_status, location",
      )
      .eq("school_id", schoolId)
      .eq("academic_year_id", placement.academicYearId)
      .is("archived_at", null)
      .order("starts_at", { ascending: false })
      .limit(50);
    yearEvents = data ?? [];
  }

  const { data: participation } = await supabase
    .from("event_participants")
    .select(
      "id, calendar_event_id, rsvp_status, participation_role, attendance_status, position_label, award_label, certificate_status, certificate_document_id, remarks, notes",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .is("archived_at", null);

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "derived",
    note: "E17 Event & Activity Engine — participation refs calendar_events (no event dump on student).",
    data: { yearEvents, participation: participation ?? [] },
  };
}

export async function loadCompetitions(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<StudentProfileModulePayload<unknown[]>> {
  const meta = def("competitions");
  const { data } = await supabase
    .from("competition_participations")
    .select(
      "id, title, role, result_label, position_label, award_label, participated_on, calendar_event_id, event_participant_id",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .is("archived_at", null)
    .order("participated_on", { ascending: false });

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "derived",
    note: "Competitions link calendar_events + event_participants (E17).",
    data: data ?? [],
  };
}

export async function loadAchievements(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<StudentProfileModulePayload<unknown[]>> {
  const meta = def("achievements");
  const { data } = await supabase
    .from("student_achievements")
    .select(
      "id, title, category, awarded_on, description, academic_year_id, term_id, source, calendar_event_id, event_participant_id, participation_role, attendance_status, award_label, position_label, certificate_status, points, remarks, photo_media_ids, attachment_media_ids, visibility, calendar_events ( id, title, starts_at, ends_at, category, location )",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .is("archived_at", null)
    .order("awarded_on", { ascending: false });

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "live",
    data: data ?? [],
  };
}

export async function loadBehaviour(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<StudentProfileModulePayload<unknown[]>> {
  const meta = def("behaviour");
  const { data } = await supabase
    .from("conduct_incidents")
    .select(
      "id, occurred_on, recorded_at, severity, category, remark_kind, visibility, title, body, description, status, follow_up_required, follow_up_status, visible_to_guardians, academic_year_id",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .is("archived_at", null)
    .is("superseded_at", null)
    .order("recorded_at", { ascending: false });

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "derived",
    note: "E13 Behaviour Engine — timestamped remarks; filter by academic_year_id.",
    data: data ?? [],
  };
}

export async function loadMedical(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
  bloodGroup: string | null,
  medicalNotes: string | null,
): Promise<StudentProfileModulePayload<MedicalData>> {
  const meta = def("medical");
  const { data: incidents } = await supabase
    .from("medical_incidents")
    .select("id, occurred_on, title, severity, description")
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .is("archived_at", null)
    .order("occurred_on", { ascending: false });

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "live",
    note: "blood_group/medical_notes are E14 columns on student_profiles; incidents schema-ready.",
    data: {
      bloodGroup,
      medicalNotes,
      incidents: (incidents ?? []).map((i) => ({
        id: i.id,
        occurredOn: i.occurred_on,
        title: i.title,
        severity: i.severity,
        description: i.description,
      })),
    },
  };
}

export async function loadDocuments(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<StudentProfileModulePayload<unknown[]>> {
  const meta = def("documents");
  const { data } = await supabase
    .from("student_issued_documents")
    .select(
      "id, document_kind, title, status, issued_on, media_path, template_id",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .is("archived_at", null)
    .order("issued_on", { ascending: false });

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "schema_ready",
    data: data ?? [],
  };
}

export async function loadParents(
  supabase: Supabase,
  studentProfileId: string,
): Promise<StudentProfileModulePayload<ParentLinkRow[]>> {
  const meta = def("parents");
  const { data: links } = await supabase
    .from("student_parent_links")
    .select("id, relationship, is_primary, parent_profile_id")
    .eq("student_profile_id", studentProfileId);

  const parentIds = (links ?? []).map((l) => l.parent_profile_id);
  if (parentIds.length === 0) {
    return {
      id: meta.id,
      name: meta.name,
      ownerEngine: meta.ownerEngine,
      source: "live",
      data: [],
    };
  }

  const { data: parents } = await supabase
    .from("parent_profiles")
    .select("id, person_id, global_id")
    .in("id", parentIds);

  const personIds = (parents ?? []).map((p) => p.person_id);
  const { data: persons } = personIds.length
    ? await supabase
        .from("persons")
        .select("id, full_name, email, phone")
        .in("id", personIds)
    : { data: [] as Array<{ id: string; full_name: string; email: string | null; phone: string | null }> };

  const parentMap = new Map((parents ?? []).map((p) => [p.id, p]));
  const personMap = new Map((persons ?? []).map((p) => [p.id, p]));

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "live",
    data: (links ?? []).map((link) => {
      const parent = parentMap.get(link.parent_profile_id);
      const person = parent ? personMap.get(parent.person_id) : null;
      return {
        linkId: link.id,
        relationship: link.relationship,
        isPrimary: link.is_primary,
        parentProfileId: link.parent_profile_id,
        parentGlobalId: parent?.global_id ?? "",
        personId: parent?.person_id ?? "",
        fullName: person?.full_name ?? "",
        email: person?.email ?? null,
        phone: person?.phone ?? null,
      };
    }),
  };
}

export async function loadTransport(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<StudentProfileModulePayload<unknown[]>> {
  const meta = def("transport");
  const { data } = await supabase
    .from("student_transport_assignments")
    .select(
      "id, route_name, stop_name, vehicle_label, pickup_time, drop_time, effective_from, effective_to, academic_year_id",
    )
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .is("archived_at", null)
    .order("effective_from", { ascending: false });

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "schema_ready",
    data: data ?? [],
  };
}

export async function loadHouse(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<StudentProfileModulePayload<HouseMembershipRow[]>> {
  const meta = def("house");
  const { data: memberships } = await supabase
    .from("house_memberships")
    .select(
      "id, house_id, role, academic_year_id, joined_on, left_on",
    )
    .eq("student_profile_id", studentProfileId)
    .order("joined_on", { ascending: false });

  const houseIds = [...new Set((memberships ?? []).map((m) => m.house_id))];
  const { data: houses } = houseIds.length
    ? await supabase
        .from("houses")
        .select("id, name")
        .eq("school_id", schoolId)
        .in("id", houseIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const houseMap = new Map((houses ?? []).map((h) => [h.id, h.name]));

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "live",
    data: (memberships ?? []).map((m) => ({
      membershipId: m.id,
      houseId: m.house_id,
      houseName: houseMap.get(m.house_id) ?? null,
      role: m.role,
      academicYearId: m.academic_year_id,
      joinedOn: m.joined_on,
      leftOn: m.left_on,
    })),
  };
}

export async function loadClubs(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<StudentProfileModulePayload<ClubMembershipRow[]>> {
  const meta = def("club_membership");
  const { data: memberships } = await supabase
    .from("club_memberships")
    .select(
      "id, club_id, role, academic_year_id, joined_on, left_on",
    )
    .eq("student_profile_id", studentProfileId)
    .order("joined_on", { ascending: false });

  const clubIds = [...new Set((memberships ?? []).map((m) => m.club_id))];
  const { data: clubs } = clubIds.length
    ? await supabase
        .from("clubs")
        .select("id, name")
        .eq("school_id", schoolId)
        .in("id", clubIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const clubMap = new Map((clubs ?? []).map((c) => [c.id, c.name]));

  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "live",
    data: (memberships ?? []).map((m) => ({
      membershipId: m.id,
      clubId: m.club_id,
      clubName: clubMap.get(m.club_id) ?? null,
      role: m.role,
      academicYearId: m.academic_year_id,
      joinedOn: m.joined_on,
      leftOn: m.left_on,
    })),
  };
}

export function loadAiSummary(): StudentProfileModulePayload<AiSummaryData> {
  const meta = def("ai_summary");
  return {
    id: meta.id,
    name: meta.name,
    ownerEngine: meta.ownerEngine,
    source: "placeholder",
    note: "E23 must not invent facts; future summary reads other modules only.",
    data: {
      status: "not_built",
      message:
        "Future AI summary will narrate attendance, academics, behaviour, and achievements after human-gated accept.",
      inputModuleIds: [
        "personal",
        "academic_history",
        "attendance",
        "assessments",
        "behaviour",
        "achievements",
        "house",
        "club_membership",
      ],
    },
  };
}
