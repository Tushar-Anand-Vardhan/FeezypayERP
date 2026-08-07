"use server";

import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import { assertStudentInSchool } from "@/lib/student-profile/server-helpers";

/**
 * Messages / notices relevant to a student (class/section scoped + school-wide).
 * Not a school-wide message dump.
 */
export async function listMessagesForStudentAction(input: {
  studentProfileId: string;
  academicYearId?: string;
  limit?: number;
}): Promise<
  | { success: true; rows: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext(
    "communication.message.read",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const owned = await assertStudentInSchool(
    supabase,
    schoolId,
    input.studentProfileId,
  );
  if (!owned) {
    return { success: false, error: "Student not found." };
  }

  let classId: string | null = null;
  let sectionId: string | null = null;
  if (input.academicYearId) {
    const { data: placement } = await supabase
      .from("student_academic_years")
      .select("class_id, section_id")
      .eq("admission_id", owned.admissionId)
      .eq("academic_year_id", input.academicYearId)
      .eq("status", "active")
      .is("left_on", null)
      .maybeSingle();
    classId = (placement?.class_id as string | undefined) ?? null;
    sectionId = (placement?.section_id as string | undefined) ?? null;
  }

  let query = supabase
    .from("comm_messages")
    .select(
      "id, title, body, message_kind, status, published_at, class_id, section_id, department_id, academic_year_id, created_at",
    )
    .eq("school_id", schoolId)
    .eq("status", "published")
    .is("archived_at", null)
    .order("published_at", { ascending: false })
    .limit(input.limit ?? 40);

  if (input.academicYearId) {
    query = query.or(
      `academic_year_id.eq.${input.academicYearId},academic_year_id.is.null`,
    );
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  const rows = (data ?? []).filter((m) => {
    const msgClass = m.class_id as string | null;
    const msgSection = m.section_id as string | null;
    // School-wide (no class/section)
    if (!msgClass && !msgSection) return true;
    if (msgSection && sectionId && msgSection === sectionId) return true;
    if (msgClass && classId && msgClass === classId && !msgSection) return true;
    return false;
  });

  // Also surface in-app notifications targeted at this student
  const { data: deliveries } = await supabase
    .from("notification_delivery_requests")
    .select(
      "id, title, body, notification_type_code, status, sent_at, created_at, message_id",
    )
    .eq("school_id", schoolId)
    .eq("recipient_student_profile_id", input.studentProfileId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 40);

  const notifyRows = (deliveries ?? []).map((d) => ({
    id: `notify:${d.id}`,
    title: d.title,
    body: d.body,
    message_kind: d.notification_type_code ?? "notification",
    status: d.status,
    published_at: d.sent_at ?? d.created_at,
    source: "notification",
  }));

  const messageRows = rows.map((m) => ({ ...m, source: "message" }));
  const merged = [...messageRows, ...notifyRows].slice(0, input.limit ?? 40);

  return { success: true, rows: merged };
}
