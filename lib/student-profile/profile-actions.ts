"use server";

import {
  buildStudentProfile,
  listStudentDirectory,
  loadStudentProfileModule,
} from "@/lib/student-profile/aggregate";
import { assertStudentInSchool } from "@/lib/student-profile/server-helpers";
import type {
  PersonalInformationInput,
  StudentDirectoryRow,
  StudentProfileActionResult,
  StudentProfileAggregate,
  StudentProfileModuleId,
  StudentProfileModulePayload,
} from "@/lib/student-profile/types";
import {
  trimPersonalInput,
  validatePersonalInput,
} from "@/lib/student-profile/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listStudentProfileDirectoryAction(): Promise<
  | { success: true; students: StudentDirectoryRow[] }
  | { success: false; error: string }
> {
  const ctx = await getAuthenticatedSchoolContext("enrollment.admission.read");
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  try {
    const students = await listStudentDirectory(ctx.supabase, ctx.schoolId);
    return { success: true, students };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to list student directory.",
    };
  }
}

export async function getStudentProfileAction(
  studentProfileId: string,
): Promise<
  | { success: true; profile: StudentProfileAggregate }
  | { success: false; error: string }
> {
  const ctx = await getAuthenticatedSchoolContext("enrollment.admission.read");
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  if (!studentProfileId?.trim()) {
    return { success: false, error: "Student profile id is required." };
  }

  try {
    const profile = await buildStudentProfile(
      ctx.supabase,
      ctx.schoolId,
      studentProfileId.trim(),
    );
    if (!profile) {
      return { success: false, error: "Student not found in this school." };
    }
    return { success: true, profile };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load student profile.",
    };
  }
}

export async function getStudentProfileModuleAction(
  studentProfileId: string,
  moduleId: StudentProfileModuleId,
): Promise<
  | { success: true; module: StudentProfileModulePayload }
  | { success: false; error: string }
> {
  const ctx = await getAuthenticatedSchoolContext("enrollment.admission.read");
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  try {
    const modulePayload = await loadStudentProfileModule(
      ctx.supabase,
      ctx.schoolId,
      studentProfileId.trim(),
      moduleId,
    );
    if (!modulePayload) {
      return { success: false, error: "Student or module not found." };
    }
    return { success: true, module: modulePayload };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load student profile module.",
    };
  }
}

/**
 * Façade write into owning tables (E04 persons + E14 cols on student_profiles).
 * Does not create a parallel profile store.
 */
export async function updateStudentPersonalInformationAction(
  input: PersonalInformationInput,
): Promise<StudentProfileActionResult> {
  const ctx = await getAuthenticatedSchoolContext("enrollment.admission.read");
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  const trimmed = trimPersonalInput(input);
  const fieldErrors = validatePersonalInput(trimmed);
  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: "Validation failed.", fieldErrors };
  }

  const owned = await assertStudentInSchool(
    ctx.supabase,
    ctx.schoolId,
    trimmed.studentProfileId,
  );
  if (!owned) {
    return { success: false, error: "Student not found in this school." };
  }

  const now = new Date().toISOString();
  const personPatch: Record<string, unknown> = {
    full_name: trimmed.fullName,
    first_name: trimmed.firstName ?? null,
    last_name: trimmed.lastName ?? null,
    date_of_birth: trimmed.dateOfBirth || null,
    gender: trimmed.gender || null,
    email: trimmed.email || null,
    phone: trimmed.phone || null,
    address: trimmed.address || null,
    updated_at: now,
  };
  if (trimmed.photoPath !== undefined) {
    personPatch.photo_path = trimmed.photoPath;
  }

  const { error: personError } = await ctx.supabase
    .from("persons")
    .update(personPatch)
    .eq("id", owned.personId);

  if (personError) {
    return { success: false, error: personError.message };
  }

  const profilePatch: Record<string, unknown> = { updated_at: now };
  if (trimmed.bloodGroup !== undefined) {
    profilePatch.blood_group = trimmed.bloodGroup || null;
  }
  if (trimmed.medicalNotes !== undefined) {
    profilePatch.medical_notes = trimmed.medicalNotes || null;
  }

  const { error: profileError } = await ctx.supabase
    .from("student_profiles")
    .update(profilePatch)
    .eq("id", owned.studentProfileId);

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  return { success: true, message: "Personal information updated." };
}
