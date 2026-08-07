import type { createClient } from "@/lib/supabase/server";
import type { MessageAudience } from "@/lib/communications/ops-types";
import type { RecipientTarget } from "@/lib/notifications/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ResolvedRecipient = RecipientTarget & {
  key: string;
};

/**
 * Resolve audience targeting into unique recipient targets.
 * Does not send — E19 enqueue happens separately.
 */
export async function resolveMessageAudience(
  supabase: Supabase,
  schoolId: string,
  input: {
    audience: MessageAudience;
    messageKind: string;
    classId?: string | null;
    sectionId?: string | null;
    departmentId?: string | null;
    academicYearId?: string | null;
  },
): Promise<ResolvedRecipient[]> {
  const audience = { ...input.audience };
  const classIds = new Set(audience.classIds ?? []);
  const sectionIds = new Set(audience.sectionIds ?? []);
  if (input.classId) classIds.add(input.classId);
  if (input.sectionId) sectionIds.add(input.sectionId);

  // Kind defaults
  if (input.messageKind === "parent_notice") {
    audience.includeParents = audience.includeParents ?? true;
  }
  if (input.messageKind === "student_notice") {
    audience.includeStudents = audience.includeStudents ?? true;
  }
  if (
    input.messageKind === "department" ||
    input.messageKind === "teacher"
  ) {
    audience.includeStaff = audience.includeStaff ?? true;
  }
  if (input.messageKind === "announcement" || input.messageKind === "circular") {
    audience.includeParents = audience.includeParents ?? true;
    audience.includeStaff = audience.includeStaff ?? true;
  }
  if (input.messageKind === "class") {
    audience.includeParents = audience.includeParents ?? true;
    audience.includeStudents = audience.includeStudents ?? true;
  }

  const map = new Map<string, ResolvedRecipient>();

  const add = (r: ResolvedRecipient) => {
    if (!map.has(r.key)) map.set(r.key, r);
  };

  // Explicit lists
  for (const id of audience.studentProfileIds ?? []) {
    add({ key: `stu:${id}`, studentProfileId: id });
  }
  for (const id of audience.parentProfileIds ?? []) {
    add({ key: `par:${id}`, parentProfileId: id });
  }
  for (const id of audience.employmentIds ?? []) {
    add({ key: `emp:${id}`, employmentId: id });
  }

  const needStudents = Boolean(audience.includeStudents);
  const needParents = Boolean(audience.includeParents);
  const scopedByClass = classIds.size > 0 || sectionIds.size > 0;

  if (needStudents || needParents) {
    let sayQuery = supabase
      .from("student_academic_years")
      .select("id, class_id, section_id, admission_id")
      .eq("status", "active")
      .is("left_on", null)
      .limit(2000);

    if (input.academicYearId) {
      sayQuery = sayQuery.eq("academic_year_id", input.academicYearId);
    }
    if (sectionIds.size) {
      sayQuery = sayQuery.in("section_id", [...sectionIds]);
    } else if (classIds.size) {
      sayQuery = sayQuery.in("class_id", [...classIds]);
    }

    const { data: placements } = await sayQuery;
    const admissionIds = [
      ...new Set((placements ?? []).map((p) => p.admission_id as string)),
    ];

    // When school-wide (no class/section), still resolve via school admissions
    let schoolAdmissionIds = admissionIds;
    if (!scopedByClass && !input.academicYearId) {
      const { data: admissions } = await supabase
        .from("student_admissions")
        .select("id, student_profile_id")
        .eq("school_id", schoolId)
        .limit(2000);
      schoolAdmissionIds = (admissions ?? []).map((a) => a.id as string);

      if (needStudents) {
        for (const a of admissions ?? []) {
          add({
            key: `stu:${a.student_profile_id}`,
            studentProfileId: a.student_profile_id as string,
          });
        }
      }
      if (needParents) {
        const profileIds = (admissions ?? []).map(
          (a) => a.student_profile_id as string,
        );
        if (profileIds.length) {
          const { data: links } = await supabase
            .from("student_parent_links")
            .select("parent_profile_id")
            .in("student_profile_id", profileIds);
          for (const l of links ?? []) {
            add({
              key: `par:${l.parent_profile_id}`,
              parentProfileId: l.parent_profile_id as string,
            });
          }
        }
      }
    } else if (schoolAdmissionIds.length) {
      const { data: admissions } = await supabase
        .from("student_admissions")
        .select("id, student_profile_id")
        .eq("school_id", schoolId)
        .in("id", schoolAdmissionIds);

      if (needStudents) {
        for (const a of admissions ?? []) {
          add({
            key: `stu:${a.student_profile_id}`,
            studentProfileId: a.student_profile_id as string,
          });
        }
      }

      if (needParents) {
        const profileIds = (admissions ?? []).map(
          (a) => a.student_profile_id as string,
        );
        if (profileIds.length) {
          const { data: links } = await supabase
            .from("student_parent_links")
            .select("parent_profile_id")
            .in("student_profile_id", profileIds);
          for (const l of links ?? []) {
            add({
              key: `par:${l.parent_profile_id}`,
              parentProfileId: l.parent_profile_id as string,
            });
          }
        }
      }
    }
  }

  // Staff
  if (audience.includeStaff) {
    if (input.departmentId) {
      const { data: memberships } = await supabase
        .from("department_memberships")
        .select("employment_id")
        .eq("department_id", input.departmentId)
        .is("left_on", null)
        .limit(500);
      for (const m of memberships ?? []) {
        add({
          key: `emp:${m.employment_id}`,
          employmentId: m.employment_id as string,
        });
      }
    } else {
      const { data: employments } = await supabase
        .from("teacher_employments")
        .select("id")
        .eq("school_id", schoolId)
        .eq("status", "active")
        .limit(500);
      for (const e of employments ?? []) {
        add({ key: `emp:${e.id}`, employmentId: e.id as string });
      }
    }
  }

  return [...map.values()];
}
