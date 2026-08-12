"use server";

import { revalidatePath } from "next/cache";
import { hashAadhaar } from "@/lib/identity/aadhaar";
import { getActiveYearClassesForSchool } from "@/lib/onboarding/school-classes-server";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import {
  trimStudentRows,
  validateStudentRows,
  type StudentFormRow,
} from "@/lib/onboarding/students";
import {
  syncParentMembership,
  syncStudentMembership,
} from "@/lib/membership/sync";

type Result =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type StudentsStepData =
  | {
      success: true;
      blocked: false;
      classSections: Array<{
        classId: string;
        className: string;
        sectionId: string;
        sectionName: string;
      }>;
      students: StudentFormRow[];
    }
  | { success: true; blocked: true }
  | { success: false; error: string };

type PersonHit = {
  id: string;
  email: string | null;
  aadhaar_hash: string | null;
};

async function resolveStudentPerson(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  row: StudentFormRow,
): Promise<{ personId: string; studentProfileId: string } | { error: string }> {
  const aadhaar = row.aadhaar ? hashAadhaar(row.aadhaar) : null;

  const { data: matches, error: lookupError } = await supabase.rpc(
    "find_person_by_identity",
    {
      p_email: row.email || null,
      p_aadhaar_hash: aadhaar?.hash ?? null,
    },
  );

  if (lookupError) {
    return { error: lookupError.message };
  }

  const hit = (Array.isArray(matches) ? matches[0] : matches) as
    | PersonHit
    | undefined;

  if (hit) {
    if (aadhaar && hit.aadhaar_hash && hit.aadhaar_hash !== aadhaar.hash) {
      return {
        error: `Identity conflict for ${row.fullName}: email/Aadhaar mismatch.`,
      };
    }

    const { data: profiles } = await supabase.rpc(
      "get_student_profile_for_person",
      { p_person_id: hit.id },
    );
    const profile = Array.isArray(profiles) ? profiles[0] : profiles;

    await supabase.rpc("update_person_record", {
      p_person_id: hit.id,
      p_full_name: row.fullName,
      p_date_of_birth: row.dateOfBirth || null,
      p_gender: row.gender || null,
      p_email: row.email || hit.email,
      p_aadhaar_hash: aadhaar?.hash ?? null,
      p_aadhaar_last4: aadhaar?.last4 ?? null,
    });

    if (profile?.id) {
      return { personId: hit.id, studentProfileId: profile.id };
    }

    const { data: createdId, error } = await supabase.rpc(
      "create_student_profile_record",
      { p_person_id: hit.id },
    );
    if (error || !createdId) {
      return { error: error?.message ?? "Could not create student profile." };
    }
    return { personId: hit.id, studentProfileId: createdId as string };
  }

  const { data: personId, error: personError } = await supabase.rpc(
    "create_person_record",
    {
      p_full_name: row.fullName,
      p_date_of_birth: row.dateOfBirth || null,
      p_gender: row.gender || null,
      p_email: row.email || null,
      p_aadhaar_hash: aadhaar?.hash ?? null,
      p_aadhaar_last4: aadhaar?.last4 ?? null,
    },
  );

  if (personError || !personId) {
    return { error: personError?.message ?? "Could not create person." };
  }

  const { data: profileId, error: profileError } = await supabase.rpc(
    "create_student_profile_record",
    { p_person_id: personId },
  );

  if (profileError || !profileId) {
    return {
      error: profileError?.message ?? "Could not create student profile.",
    };
  }

  return {
    personId: personId as string,
    studentProfileId: profileId as string,
  };
}

export async function getStudentsStepDataAction(): Promise<StudentsStepData> {
  const context = await getAuthenticatedSchoolContext("onboarding.wizard.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const classesResult = await getActiveYearClassesForSchool(supabase, schoolId);
  if ("blocked" in classesResult) {
    return { success: true, blocked: true };
  }
  if ("error" in classesResult) {
    return { success: false, error: classesResult.error };
  }

  const classIds = classesResult.classes.map((row) => row.id);
  const { data: sections } = await supabase
    .from("sections")
    .select("id, name, class_id")
    .in("class_id", classIds)
    .order("display_order");

  if (!sections || sections.length === 0) {
    return { success: true, blocked: true };
  }

  const classNameById = new Map(
    classesResult.classes.map((row) => [row.id, row.name]),
  );

  const classSections = sections.map((section) => ({
    classId: section.class_id,
    className: classNameById.get(section.class_id) ?? "",
    sectionId: section.id,
    sectionName: section.name,
  }));

  const { data: admissions } = await supabase
    .from("student_admissions")
    .select(
      "admission_number, student_profiles(id, persons(full_name, date_of_birth, gender, email, aadhaar_last4), student_parent_links(relationship, parent_profiles(persons(full_name, phone, email)))), student_academic_years(status, left_on, class_id, section_id)",
    )
    .eq("school_id", schoolId)
    .eq("status", "active");

  const sectionNameById = new Map(sections.map((row) => [row.id, row.name]));

  return {
    success: true,
    blocked: false,
    classSections,
    students: (admissions ?? []).map((admission) => {
      const profileRaw = admission.student_profiles as
        | {
            id: string;
            persons:
              | {
                  full_name: string;
                  date_of_birth: string | null;
                  gender: string | null;
                  email: string | null;
                  aadhaar_last4: string | null;
                }
              | {
                  full_name: string;
                  date_of_birth: string | null;
                  gender: string | null;
                  email: string | null;
                  aadhaar_last4: string | null;
                }[]
              | null;
            student_parent_links: unknown;
          }
        | {
            id: string;
            persons:
              | {
                  full_name: string;
                  date_of_birth: string | null;
                  gender: string | null;
                  email: string | null;
                  aadhaar_last4: string | null;
                }
              | {
                  full_name: string;
                  date_of_birth: string | null;
                  gender: string | null;
                  email: string | null;
                  aadhaar_last4: string | null;
                }[]
              | null;
            student_parent_links: unknown;
          }[]
        | null;

      const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
      const personRaw = profile?.persons;
      const person = Array.isArray(personRaw) ? personRaw[0] : personRaw;

      const years = Array.isArray(admission.student_academic_years)
        ? admission.student_academic_years
        : [];
      const active = years.find(
        (row) => row.status === "active" && !row.left_on,
      );

      const links = Array.isArray(profile?.student_parent_links)
        ? profile.student_parent_links
        : [];

      return {
        fullName: person?.full_name ?? "",
        dateOfBirth: person?.date_of_birth ?? "",
        gender: (person?.gender as "" | "male" | "female" | "other") ?? "",
        admissionNumber: admission.admission_number,
        aadhaar: person?.aadhaar_last4
          ? `********${person.aadhaar_last4}`
          : "",
        email: person?.email ?? "",
        className: active ? (classNameById.get(active.class_id) ?? "") : "",
        sectionName: active
          ? (sectionNameById.get(active.section_id) ?? "")
          : "",
        guardians: links.map((link) => {
          const typed = link as {
            relationship: string;
            parent_profiles:
              | {
                  persons:
                    | {
                        full_name: string;
                        phone: string | null;
                        email: string | null;
                      }
                    | {
                        full_name: string;
                        phone: string | null;
                        email: string | null;
                      }[]
                    | null;
                }
              | {
                  persons:
                    | {
                        full_name: string;
                        phone: string | null;
                        email: string | null;
                      }
                    | {
                        full_name: string;
                        phone: string | null;
                        email: string | null;
                      }[]
                    | null;
                }[]
              | null;
          };
          const parentProfile = Array.isArray(typed.parent_profiles)
            ? typed.parent_profiles[0]
            : typed.parent_profiles;
          const parentPersonRaw = parentProfile?.persons;
          const parentPerson = Array.isArray(parentPersonRaw)
            ? parentPersonRaw[0]
            : parentPersonRaw;

          return {
            fullName: parentPerson?.full_name ?? "",
            relationship: typed.relationship,
            phone: parentPerson?.phone ?? "",
            whatsappNumber: parentPerson?.phone ?? "",
            email: parentPerson?.email ?? "",
            whatsappOptIn: false,
          };
        }),
      };
    }),
  };
}

export async function saveStudentsAction(formData: FormData): Promise<Result> {
  const context = await getAuthenticatedSchoolContext("onboarding.wizard.edit");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const intent = String(formData.get("intent") ?? "save");

  let rows: StudentFormRow[] = [];
  try {
    rows = JSON.parse(String(formData.get("students") ?? "[]")) as StudentFormRow[];
  } catch {
    return { success: false, error: "Could not read student data." };
  }

  rows = rows.map((row) => ({
    ...row,
    aadhaar: row.aadhaar?.includes("*") ? "" : (row.aadhaar ?? ""),
  }));

  const classesResult = await getActiveYearClassesForSchool(supabase, schoolId);
  if ("error" in classesResult) {
    return { success: false, error: classesResult.error };
  }
  if ("blocked" in classesResult) {
    return { success: false, error: "Complete Classes and Sections first." };
  }

  const classIds = classesResult.classes.map((row) => row.id);
  const { data: sections } = await supabase
    .from("sections")
    .select("id, name, class_id")
    .in("class_id", classIds);

  const classNameById = new Map(
    classesResult.classes.map((row) => [row.id, row.name]),
  );
  const pairKey = (className: string, sectionName: string) =>
    `${className.toLowerCase()}::${sectionName.toLowerCase()}`;
  const sectionByPair = new Map(
    (sections ?? []).map((section) => [
      pairKey(classNameById.get(section.class_id) ?? "", section.name),
      { classId: section.class_id, sectionId: section.id },
    ]),
  );

  const fieldErrors = validateStudentRows(
    rows,
    (sections ?? []).map((section) => ({
      className: classNameById.get(section.class_id) ?? "",
      sectionName: section.name,
    })),
    { requireAtLeastOne: intent === "next" },
  );
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const trimmed = trimStudentRows(rows);

  if (intent === "save" && trimmed.length === 0) {
    const { count } = await supabase
      .from("student_admissions")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active");
    if ((count ?? 0) > 0) {
      return {
        success: false,
        error:
          "Saving an empty student list would close all active admissions. Add at least one student, or keep existing rows.",
      };
    }
  }

  // Diff by admission number within this school; never wipe global persons.
  const { data: existingAdmissions } = await supabase
    .from("student_admissions")
    .select("id, admission_number, student_profile_id, status")
    .eq("school_id", schoolId);

  const admissionByNumber = new Map(
    (existingAdmissions ?? []).map((row) => [
      row.admission_number.toLowerCase(),
      row,
    ]),
  );
  const keepAdmissionIds = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  const academicYearId = classesResult.academicYear.id;

  for (const row of trimmed) {
    const pair = sectionByPair.get(pairKey(row.className, row.sectionName));
    if (!pair) {
      return {
        success: false,
        error: `Could not resolve ${row.className} / ${row.sectionName}.`,
      };
    }

    const resolved = await resolveStudentPerson(supabase, row);
    if ("error" in resolved) {
      return { success: false, error: resolved.error };
    }

    const { assertNoOtherActiveAdmission } = await import(
      "@/lib/enrollment/admission-guards"
    );
    const d14 = await assertNoOtherActiveAdmission(
      supabase,
      resolved.studentProfileId,
      schoolId,
    );
    if (!d14.ok) {
      return {
        success: false,
        error: `${row.fullName} (${row.admissionNumber}): ${d14.error}`,
      };
    }

    const existing = admissionByNumber.get(row.admissionNumber.toLowerCase());
    if (
      existing &&
      existing.student_profile_id !== resolved.studentProfileId
    ) {
      return {
        success: false,
        error: `Admission number ${row.admissionNumber} is already linked to a different student.`,
      };
    }

    let admissionId = existing?.id;

    if (admissionId) {
      const { error: updateError } = await supabase
        .from("student_admissions")
        .update({
          student_profile_id: resolved.studentProfileId,
          status: "active",
          exited_on: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", admissionId);
      if (updateError) {
        return { success: false, error: updateError.message };
      }

      const { data: yearRows } = await supabase
        .from("student_academic_years")
        .select("id")
        .eq("admission_id", admissionId)
        .eq("academic_year_id", academicYearId)
        .eq("status", "active")
        .is("left_on", null)
        .limit(1);

      const yearId = yearRows?.[0]?.id;
      if (yearId) {
        const { error: yearUpdateError } = await supabase
          .from("student_academic_years")
          .update({
            class_id: pair.classId,
            section_id: pair.sectionId,
            status: "active",
            left_on: null,
          })
          .eq("id", yearId);
        if (yearUpdateError) {
          return { success: false, error: yearUpdateError.message };
        }
      } else {
        const { error: yearInsertError } = await supabase
          .from("student_academic_years")
          .insert({
            admission_id: admissionId,
            academic_year_id: academicYearId,
            class_id: pair.classId,
            section_id: pair.sectionId,
            enrolled_on: today,
            status: "active",
            enrollment_type: "new_admission",
          });
        if (yearInsertError) {
          return { success: false, error: yearInsertError.message };
        }
      }
    } else {
      const { data: admission, error: admissionError } = await supabase
        .from("student_admissions")
        .insert({
          student_profile_id: resolved.studentProfileId,
          school_id: schoolId,
          admission_number: row.admissionNumber,
          admitted_on: today,
          status: "active",
        })
        .select("id")
        .single();

      if (admissionError || !admission) {
        return {
          success: false,
          error: admissionError?.message ?? "Could not save admission.",
        };
      }
      admissionId = admission.id;

      const { error: yearError } = await supabase
        .from("student_academic_years")
        .insert({
          admission_id: admissionId,
          academic_year_id: academicYearId,
          class_id: pair.classId,
          section_id: pair.sectionId,
          enrolled_on: today,
          status: "active",
          enrollment_type: "new_admission",
        });

      if (yearError) {
        return { success: false, error: yearError.message };
      }
    }

    keepAdmissionIds.add(admissionId);
    await syncStudentMembership(supabase, admissionId);

    const primaryGuardian = row.guardians[0];
    if (primaryGuardian?.fullName) {
      const { data: parentMatches } = await supabase.rpc(
        "find_person_by_identity",
        {
          p_email: primaryGuardian.email || null,
          p_aadhaar_hash: null,
        },
      );
      const parentHit = (
        Array.isArray(parentMatches) ? parentMatches[0] : parentMatches
      ) as PersonHit | undefined;

      let parentPersonId = parentHit?.id;
      if (!parentPersonId) {
        const { data: createdParentId, error: parentPersonError } =
          await supabase.rpc("create_person_record", {
            p_full_name: primaryGuardian.fullName,
            p_phone: primaryGuardian.phone || null,
            p_email: primaryGuardian.email || null,
          });
        if (parentPersonError || !createdParentId) {
          return {
            success: false,
            error: parentPersonError?.message ?? "Could not save parent.",
          };
        }
        parentPersonId = createdParentId as string;
      } else {
        await supabase.rpc("update_person_record", {
          p_person_id: parentPersonId,
          p_full_name: primaryGuardian.fullName,
          p_phone: primaryGuardian.phone || null,
          p_email: primaryGuardian.email || parentHit?.email,
        });
      }

      const { data: parentProfileId, error: parentProfileError } =
        await supabase.rpc("create_parent_profile_record", {
          p_person_id: parentPersonId,
        });

      if (parentProfileError || !parentProfileId) {
        return {
          success: false,
          error:
            parentProfileError?.message ?? "Could not create parent profile.",
        };
      }

      await supabase.from("student_parent_links").upsert(
        {
          student_profile_id: resolved.studentProfileId,
          parent_profile_id: parentProfileId,
          relationship: primaryGuardian.relationship || "parent",
          is_primary: true,
        },
        { onConflict: "student_profile_id,parent_profile_id" },
      );

      const { data: linkRow } = await supabase
        .from("student_parent_links")
        .select("id")
        .eq("student_profile_id", resolved.studentProfileId)
        .eq("parent_profile_id", parentProfileId)
        .maybeSingle();
      if (linkRow?.id) {
        await syncParentMembership(supabase, linkRow.id);
      }

      // Wave 6 F10: invite parent by email when present
      if (primaryGuardian.email?.trim() && parentPersonId) {
        try {
          const { createInviteAction } = await import(
            "@/lib/auth/invites-actions"
          );
          await createInviteAction({
            email: primaryGuardian.email.trim(),
            personId: parentPersonId,
            targetPersona: "parent",
            parentProfileId: String(parentProfileId),
            admissionId,
          });
        } catch {
          // Invite is best-effort; admission save should not fail on invite errors.
        }
      }
    }
  }

  const toEnd = (existingAdmissions ?? [])
    .filter((row) => row.status === "active" && !keepAdmissionIds.has(row.id))
    .map((row) => row.id);

  if (toEnd.length > 0) {
    await supabase
      .from("student_academic_years")
      .update({
        status: "withdrawn",
        left_on: today,
      })
      .in("admission_id", toEnd)
      .eq("status", "active");

    await supabase
      .from("student_admissions")
      .update({
        status: "withdrawn",
        exited_on: today,
        updated_at: new Date().toISOString(),
      })
      .in("id", toEnd);

    for (const endedId of toEnd) {
      await syncStudentMembership(supabase, endedId);
    }
  }

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "Students saved successfully." };
}
