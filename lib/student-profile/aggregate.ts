import type { createClient } from "@/lib/supabase/server";
import {
  loadAcademicHistory,
  loadAchievements,
  loadAdmission,
  loadAiSummary,
  loadAssessments,
  loadAttendance,
  loadBehaviour,
  loadClubs,
  loadCompetitions,
  loadDocuments,
  loadEvents,
  loadHouse,
  loadMedical,
  loadParents,
  loadPersonal,
  loadReportCards,
  loadTransport,
} from "@/lib/student-profile/loaders";
import { assertStudentInSchool } from "@/lib/student-profile/server-helpers";
import type {
  StudentProfileAggregate,
  StudentProfileModuleId,
  StudentProfileModulePayload,
  StudentDirectoryRow,
} from "@/lib/student-profile/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function buildStudentProfile(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<StudentProfileAggregate | null> {
  const ctx = await assertStudentInSchool(supabase, schoolId, studentProfileId);
  if (!ctx) {
    return null;
  }

  const [
    personal,
    admission,
    academicHistory,
    attendance,
    assessments,
    reportCards,
    events,
    competitions,
    achievements,
    behaviour,
    medical,
    documents,
    parents,
    transport,
    house,
    clubs,
  ] = await Promise.all([
    loadPersonal(
      supabase,
      ctx.studentProfileId,
      ctx.personId,
      ctx.studentGlobalId,
    ),
    loadAdmission(supabase, schoolId, ctx.studentProfileId),
    loadAcademicHistory(supabase, ctx.admissionId),
    loadAttendance(supabase, schoolId, ctx.studentProfileId),
    loadAssessments(
      supabase,
      schoolId,
      ctx.studentProfileId,
      ctx.admissionId,
    ),
    loadReportCards(
      supabase,
      schoolId,
      ctx.studentProfileId,
      ctx.admissionId,
    ),
    loadEvents(supabase, schoolId, ctx.studentProfileId, ctx.admissionId),
    loadCompetitions(supabase, schoolId, ctx.studentProfileId),
    loadAchievements(supabase, schoolId, ctx.studentProfileId),
    loadBehaviour(supabase, schoolId, ctx.studentProfileId),
    loadMedical(
      supabase,
      schoolId,
      ctx.studentProfileId,
      ctx.bloodGroup,
      ctx.medicalNotes,
    ),
    loadDocuments(supabase, schoolId, ctx.studentProfileId),
    loadParents(supabase, ctx.studentProfileId),
    loadTransport(supabase, schoolId, ctx.studentProfileId),
    loadHouse(supabase, schoolId, ctx.studentProfileId),
    loadClubs(supabase, schoolId, ctx.studentProfileId),
  ]);

  const aiSummary = loadAiSummary();

  const modules = {
    personal,
    admission,
    academic_history: academicHistory,
    attendance,
    assessments,
    report_cards: reportCards,
    events,
    competitions,
    achievements,
    behaviour,
    medical,
    documents,
    parents,
    transport,
    house,
    club_membership: clubs,
    ai_summary: aiSummary,
  } as Record<StudentProfileModuleId, StudentProfileModulePayload>;

  return {
    schoolId,
    studentProfileId: ctx.studentProfileId,
    generatedAt: new Date().toISOString(),
    modules,
  };
}

export async function loadStudentProfileModule(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
  moduleId: StudentProfileModuleId,
): Promise<StudentProfileModulePayload | null> {
  const profile = await buildStudentProfile(
    supabase,
    schoolId,
    studentProfileId,
  );
  if (!profile) {
    return null;
  }
  return profile.modules[moduleId] ?? null;
}

export async function listStudentDirectory(
  supabase: Supabase,
  schoolId: string,
): Promise<StudentDirectoryRow[]> {
  const { data: admissions } = await supabase
    .from("student_admissions")
    .select("id, student_profile_id, admission_number, status")
    .eq("school_id", schoolId)
    .order("admission_number", { ascending: true });

  if (!admissions?.length) {
    return [];
  }

  const profileIds = admissions.map((a) => a.student_profile_id);
  const { data: profiles } = await supabase
    .from("student_profiles")
    .select("id, person_id, global_id")
    .in("id", profileIds);

  const personIds = (profiles ?? []).map((p) => p.person_id);
  const { data: persons } = personIds.length
    ? await supabase
        .from("persons")
        .select("id, full_name")
        .in("id", personIds)
    : { data: [] as Array<{ id: string; full_name: string }> };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const personMap = new Map((persons ?? []).map((p) => [p.id, p]));

  const admissionIds = admissions.map((a) => a.id);
  const { data: placements } = await supabase
    .from("student_academic_years")
    .select("admission_id, class_id, section_id, roll_number, status, left_on")
    .in("admission_id", admissionIds)
    .eq("status", "active")
    .is("left_on", null);

  const classIds = [
    ...new Set((placements ?? []).map((p) => p.class_id).filter(Boolean)),
  ];
  const sectionIds = [
    ...new Set((placements ?? []).map((p) => p.section_id).filter(Boolean)),
  ];

  const [{ data: classes }, { data: sections }] = await Promise.all([
    classIds.length
      ? supabase.from("classes").select("id, name").in("id", classIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    sectionIds.length
      ? supabase.from("sections").select("id, name").in("id", sectionIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const sectionMap = new Map((sections ?? []).map((s) => [s.id, s.name]));
  const placementByAdmission = new Map(
    (placements ?? []).map((p) => [p.admission_id, p]),
  );

  return admissions.map((a) => {
    const profile = profileMap.get(a.student_profile_id);
    const person = profile ? personMap.get(profile.person_id) : null;
    const placement = placementByAdmission.get(a.id);
    return {
      studentProfileId: a.student_profile_id,
      personId: profile?.person_id ?? "",
      fullName: person?.full_name ?? "",
      studentGlobalId: profile?.global_id ?? "",
      admissionId: a.id,
      admissionNumber: a.admission_number,
      admissionStatus: a.status,
      className: placement ? (classMap.get(placement.class_id) ?? null) : null,
      sectionName: placement
        ? (sectionMap.get(placement.section_id) ?? null)
        : null,
      rollNumber: placement?.roll_number ?? null,
    };
  });
}
