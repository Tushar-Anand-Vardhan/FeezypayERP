import type { createClient } from "@/lib/supabase/server";
import {
  teacherMayEditWorkflow,
  visibilityForWorkflow,
} from "@/lib/attendance/validation";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getActorId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function assertYearOwned(
  supabase: Supabase,
  schoolId: string,
  yearId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", yearId)
    .eq("school_id", schoolId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function assertSectionInSchool(
  supabase: Supabase,
  schoolId: string,
  sectionId: string,
): Promise<{ classId: string; academicYearId: string } | null> {
  const { data: section } = await supabase
    .from("sections")
    .select("id, class_id")
    .eq("id", sectionId)
    .maybeSingle();
  if (!section) return null;

  const { data: klass } = await supabase
    .from("classes")
    .select("id, academic_year_id")
    .eq("id", section.class_id)
    .maybeSingle();
  if (!klass) return null;

  const { data: year } = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", klass.academic_year_id)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!year) return null;

  return {
    classId: klass.id,
    academicYearId: klass.academic_year_id,
  };
}

export async function assertStudentInSchool(
  supabase: Supabase,
  schoolId: string,
  studentProfileId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("student_admissions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("student_profile_id", studentProfileId)
    .maybeSingle();
  return Boolean(data);
}

export async function assertEmploymentOwned(
  supabase: Supabase,
  schoolId: string,
  employmentId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("teacher_employments")
    .select("id")
    .eq("id", employmentId)
    .eq("school_id", schoolId)
    .eq("status", "active")
    .maybeSingle();
  return Boolean(data);
}

export async function writeAttendanceAudit(
  supabase: Supabase,
  input: {
    schoolId: string;
    action: string;
    actorId?: string | null;
    employmentId?: string | null;
    sessionId?: string | null;
    recordId?: string | null;
    leaveRequestId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("attendance_audit_log").insert({
    school_id: input.schoolId,
    action: input.action,
    actor_id: input.actorId ?? null,
    employment_id: input.employmentId ?? null,
    session_id: input.sessionId ?? null,
    record_id: input.recordId ?? null,
    leave_request_id: input.leaveRequestId ?? null,
    old_values: input.oldValues ?? null,
    new_values: input.newValues ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.error("attendance_audit_log insert failed:", error.message);
  }
}

export async function getOrCreateDailySession(
  supabase: Supabase,
  input: {
    schoolId: string;
    academicYearId: string;
    sectionId: string;
    attendanceDate: string;
    employmentId?: string | null;
  },
): Promise<
  | {
      id: string;
      workflow_status: string;
      locked_at: string | null;
      approved_at: string | null;
    }
  | { error: string }
> {
  const { data: existing } = await supabase
    .from("attendance_sessions")
    .select("id, workflow_status, locked_at, approved_at")
    .eq("section_id", input.sectionId)
    .eq("attendance_date", input.attendanceDate)
    .eq("scope", "daily")
    .is("period_definition_id", null)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data: created, error } = await supabase
    .from("attendance_sessions")
    .insert({
      school_id: input.schoolId,
      academic_year_id: input.academicYearId,
      section_id: input.sectionId,
      attendance_date: input.attendanceDate,
      scope: "daily",
      period_definition_id: null,
      workflow_status: "draft",
      taken_by_employment_id: input.employmentId ?? null,
    })
    .select("id, workflow_status, locked_at, approved_at")
    .maybeSingle();

  if (error || !created) {
    return { error: error?.message ?? "Failed to create attendance session." };
  }
  return created;
}

export function assertTeacherCanEditSession(session: {
  workflow_status: string;
  locked_at: string | null;
}): string | null {
  if (!teacherMayEditWorkflow(session.workflow_status, session.locked_at)) {
    return "Attendance is approved or locked — teachers cannot edit. Use a correction.";
  }
  return null;
}

export async function listActiveStudentsInSection(
  supabase: Supabase,
  sectionId: string,
): Promise<string[]> {
  const { data: placements } = await supabase
    .from("student_academic_years")
    .select("admission_id")
    .eq("section_id", sectionId)
    .eq("status", "active")
    .is("left_on", null);

  const admissionIds = (placements ?? []).map((p) => p.admission_id);
  if (admissionIds.length === 0) {
    return [];
  }

  const { data: admissions } = await supabase
    .from("student_admissions")
    .select("student_profile_id")
    .in("id", admissionIds);

  return [
    ...new Set(
      (admissions ?? [])
        .map((a) => a.student_profile_id)
        .filter(Boolean),
    ),
  ];
}

export { visibilityForWorkflow, teacherMayEditWorkflow };
