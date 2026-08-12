"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import { syncStaffMembership } from "@/lib/membership/sync";

export type CareerActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

export async function updateTeacherCareerProfileAction(input: {
  qualification?: string | null;
  yearsExperience?: number | null;
  bio?: string | null;
  linkedinUrl?: string | null;
  preferredSubjects?: string[];
  preferredStandards?: string | null;
}): Promise<CareerActionResult> {
  const context = await getAuthenticatedSchoolContext("identity.person.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, actor } = context;
  if (!actor?.authUserId) {
    return { success: false, error: "You must be signed in." };
  }

  const { data: person } = await supabase
    .from("persons")
    .select("id")
    .eq("auth_user_id", actor.authUserId)
    .maybeSingle();
  if (!person) {
    return { success: false, error: "Person not found." };
  }

  const { data: profile } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("person_id", person.id)
    .maybeSingle();
  if (!profile) {
    return { success: false, error: "Teacher profile not found." };
  }

  const { error } = await supabase
    .from("teacher_profiles")
    .update({
      qualification: input.qualification?.trim() || null,
      years_experience:
        input.yearsExperience != null && !Number.isNaN(input.yearsExperience)
          ? input.yearsExperience
          : null,
      bio: input.bio?.trim() || null,
      linkedin_url: input.linkedinUrl?.trim() || null,
      preferred_subjects: (input.preferredSubjects ?? [])
        .map((s) => s.trim())
        .filter(Boolean),
      preferred_standards: input.preferredStandards?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/teacher/profile");
  revalidatePath("/activate/profile");
  return { success: true, message: "Career profile saved." };
}

/**
 * Self-serve leave: end own active employment at the active school (D15 unlock).
 */
export async function leaveSchoolEmploymentAction(
  employmentId?: string,
): Promise<CareerActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "workforce.employment.self_end",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId, actor } = context;
  if (!actor?.authUserId) {
    return { success: false, error: "You must be signed in." };
  }

  const { data: person } = await supabase
    .from("persons")
    .select("id")
    .eq("auth_user_id", actor.authUserId)
    .maybeSingle();
  if (!person) {
    return { success: false, error: "Person not found." };
  }

  const { data: profile } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("person_id", person.id)
    .maybeSingle();
  if (!profile) {
    return { success: false, error: "Teacher profile not found." };
  }

  let query = supabase
    .from("teacher_employments")
    .select("id, status")
    .eq("teacher_profile_id", profile.id)
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (employmentId) {
    query = query.eq("id", employmentId);
  }

  const { data: employment } = await query.maybeSingle();
  if (!employment) {
    return { success: false, error: "No active employment to leave at this school." };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("teacher_employments")
    .update({
      status: "ended",
      left_on: today,
      updated_at: new Date().toISOString(),
    })
    .eq("id", employment.id)
    .eq("teacher_profile_id", profile.id);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase
    .from("sections")
    .update({ class_teacher_id: null })
    .eq("class_teacher_id", employment.id);

  await syncStaffMembership(supabase, employment.id);

  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/teacher/profile");
  revalidatePath("/dashboard");
  return {
    success: true,
    message:
      "You left this school. Your experience history stays on your teacher profile; ask another school to invite you when ready.",
  };
}

export async function listMyEmploymentHistoryAction(): Promise<
  | {
      success: true;
      history: Array<{
        employmentId: string;
        schoolId: string;
        schoolName: string;
        status: string;
        designation: string | null;
        joinedOn: string | null;
        leftOn: string | null;
      }>;
    }
  | { success: false; error: string }
> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { success: false, error: "You must be signed in." };
  }

  const { data: person } = await supabase
    .from("persons")
    .select("id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (!person) {
    return { success: false, error: "Person not found." };
  }

  const { data: profile } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("person_id", person.id)
    .maybeSingle();
  if (!profile) {
    return { success: true, history: [] };
  }

  const { data: rows, error } = await supabase
    .from("teacher_employments")
    .select(
      "id, school_id, status, designation, joined_on, left_on, schools(name)",
    )
    .eq("teacher_profile_id", profile.id)
    .order("joined_on", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    history: (rows ?? []).map((r) => {
      const school = r.schools as
        | { name?: string }
        | { name?: string }[]
        | null;
      const name = Array.isArray(school) ? school[0]?.name : school?.name;
      return {
        employmentId: r.id,
        schoolId: r.school_id,
        schoolName: name ?? "School",
        status: r.status,
        designation: r.designation,
        joinedOn: r.joined_on,
        leftOn: r.left_on,
      };
    }),
  };
}
