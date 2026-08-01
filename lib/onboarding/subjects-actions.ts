"use server";

import { revalidatePath } from "next/cache";
import { getActiveYearClassesForSchool } from "@/lib/onboarding/school-classes-server";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";
import {
  trimSubjectRows,
  validateClassSubjectAssignments,
  validateSubjects,
  type ClassSubjectAssignmentsFormRow,
  type SubjectFormRow,
} from "@/lib/onboarding/subjects";

type SubjectActionResult =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type SubjectsStepDataResult =
  | { success: true; blocked: true }
  | {
      success: true;
      blocked: false;
      subjects: SubjectFormRow[];
      classes: Array<{ id: string; name: string }>;
      classAssignments: ClassSubjectAssignmentsFormRow[];
    }
  | { success: false; error: string };

async function verifyOwnedClassIdsForSchool(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  academicYearId: string,
  classIds: string[],
): Promise<{ error?: string }> {
  const { data: ownedClasses, error } = await supabase
    .from("classes")
    .select("id")
    .eq("academic_year_id", academicYearId);

  if (error) {
    return { error: error.message };
  }

  const ownedClassIds = new Set((ownedClasses ?? []).map((row) => row.id));

  for (const classId of classIds) {
    if (!ownedClassIds.has(classId)) {
      return { error: "One or more classes are not in your school." };
    }
  }

  return {};
}

async function verifyOwnedSubjectIdsForSchool(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  schoolId: string,
  subjectIds: string[],
): Promise<{ error?: string }> {
  const { data: ownedSubjects, error } = await supabase
    .from("subjects")
    .select("id")
    .eq("school_id", schoolId);

  if (error) {
    return { error: error.message };
  }

  const ownedSubjectIds = new Set((ownedSubjects ?? []).map((row) => row.id));

  for (const subjectId of subjectIds) {
    if (!ownedSubjectIds.has(subjectId)) {
      return { error: "One or more subjects are not in your school." };
    }
  }

  return {};
}

/**
 * Replaces the caller's entire subject catalog for their school.
 * Uses delete-all-then-insert (not upsert): nothing else in the schema
 * references subjects.id except class_subjects, which is rewritten in the
 * same save flow immediately after insert. No cascade-fragility like Step 3.
 */
export async function saveSubjectsAction(
  formData: FormData,
): Promise<SubjectActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;

  let subjects: SubjectFormRow[] = [];

  try {
    subjects = JSON.parse(String(formData.get("subjects") ?? "[]")) as SubjectFormRow[];
  } catch {
    return { success: false, error: "Could not read the submitted subject data." };
  }

  if (!Array.isArray(subjects)) {
    return { success: false, error: "Could not read the submitted subject data." };
  }

  const trimmedSubjects = trimSubjectRows(subjects);
  const fieldErrors = validateSubjects(trimmedSubjects);

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { error: deleteError } = await supabase
    .from("subjects")
    .delete()
    .eq("school_id", schoolId);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  if (trimmedSubjects.length > 0) {
    const { error: insertError } = await supabase.from("subjects").insert(
      trimmedSubjects.map((row) => ({
        school_id: schoolId,
        name: row.name,
        code: row.code || null,
        type: row.type,
      })),
    );

    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  revalidatePath("/onboarding", "layout");

  return {
    success: true,
    message: "Subjects saved successfully.",
  };
}

export async function getSubjectsStepDataAction(): Promise<SubjectsStepDataResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const classesResult = await getActiveYearClassesForSchool(supabase, schoolId);

  if ("error" in classesResult) {
    return { success: false, error: classesResult.error };
  }

  if ("blocked" in classesResult) {
    return { success: true, blocked: true };
  }

  const { data: subjects, error: subjectsError } = await supabase
    .from("subjects")
    .select("name, code, type")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (subjectsError) {
    return { success: false, error: subjectsError.message };
  }

  const classIds = classesResult.classes.map((row) => row.id);

  const { data: classSubjectRows, error: classSubjectsError } = await supabase
    .from("class_subjects")
    .select("class_id, is_elective, subjects(name)")
    .in("class_id", classIds);

  if (classSubjectsError) {
    return { success: false, error: classSubjectsError.message };
  }

  const assignmentsByClassId = new Map<string, ClassSubjectAssignmentsFormRow>();

  for (const classRow of classesResult.classes) {
    assignmentsByClassId.set(classRow.id, {
      classId: classRow.id,
      assignedSubjects: [],
    });
  }

  for (const row of classSubjectRows ?? []) {
    const subjectRelation = row.subjects as { name: string } | { name: string }[] | null;
    const subjectName = Array.isArray(subjectRelation)
      ? subjectRelation[0]?.name
      : subjectRelation?.name;

    if (!subjectName) {
      continue;
    }

    const classAssignment = assignmentsByClassId.get(row.class_id);
    if (!classAssignment) {
      continue;
    }

    classAssignment.assignedSubjects.push({
      subjectName,
      isElective: row.is_elective,
    });
  }

  return {
    success: true,
    blocked: false,
    subjects: (subjects ?? []).map((row) => ({
      name: row.name,
      code: row.code ?? "",
      type: row.type as SubjectFormRow["type"],
    })),
    classes: classesResult.classes.map((row) => ({
      id: row.id,
      name: row.name,
    })),
    classAssignments: classesResult.classes.map(
      (row) =>
        assignmentsByClassId.get(row.id) ?? {
          classId: row.id,
          assignedSubjects: [],
        },
    ),
  };
}

export async function saveSubjectsStepAction(
  formData: FormData,
): Promise<SubjectActionResult> {
  const context = await getAuthenticatedSchoolContext();
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const classesResult = await getActiveYearClassesForSchool(supabase, schoolId);

  if ("error" in classesResult) {
    return { success: false, error: classesResult.error };
  }

  if ("blocked" in classesResult) {
    return { success: false, error: "Complete Classes first." };
  }

  let subjects: SubjectFormRow[] = [];
  let classAssignments: ClassSubjectAssignmentsFormRow[] = [];

  try {
    subjects = JSON.parse(String(formData.get("subjects") ?? "[]")) as SubjectFormRow[];
    classAssignments = JSON.parse(
      String(formData.get("classAssignments") ?? "[]"),
    ) as ClassSubjectAssignmentsFormRow[];
  } catch {
    return { success: false, error: "Could not read the submitted subject data." };
  }

  if (!Array.isArray(subjects) || !Array.isArray(classAssignments)) {
    return { success: false, error: "Could not read the submitted subject data." };
  }

  const intent = String(formData.get("intent") ?? "save");
  const trimmedSubjects = trimSubjectRows(subjects);
  const subjectFieldErrors = validateSubjects(trimmedSubjects, {
    requireAtLeastOne: intent === "next",
  });
  const assignmentFieldErrors = validateClassSubjectAssignments(
    trimmedSubjects,
    classAssignments,
  );
  const fieldErrors = { ...subjectFieldErrors, ...assignmentFieldErrors };

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const submittedClassIds = classAssignments.map((row) => row.classId);
  const classOwnership = await verifyOwnedClassIdsForSchool(
    supabase,
    classesResult.academicYear.id,
    submittedClassIds,
  );

  if (classOwnership.error) {
    return { success: false, error: classOwnership.error };
  }

  const { error: deleteSubjectsError } = await supabase
    .from("subjects")
    .delete()
    .eq("school_id", schoolId);

  if (deleteSubjectsError) {
    return { success: false, error: deleteSubjectsError.message };
  }

  if (trimmedSubjects.length === 0) {
    revalidatePath("/onboarding", "layout");
    return {
      success: true,
      message: "Subjects saved successfully.",
    };
  }

  const { data: insertedSubjects, error: insertSubjectsError } = await supabase
    .from("subjects")
    .insert(
      trimmedSubjects.map((row) => ({
        school_id: schoolId,
        name: row.name,
        code: row.code || null,
        type: row.type,
      })),
    )
    .select("id, name");

  if (insertSubjectsError || !insertedSubjects) {
    return {
      success: false,
      error: insertSubjectsError?.message ?? "Could not save subjects.",
    };
  }

  const subjectIdByName = new Map(
    insertedSubjects.map((row) => [row.name.toLowerCase(), row.id]),
  );
  const insertedSubjectIds = insertedSubjects.map((row) => row.id);
  const subjectOwnership = await verifyOwnedSubjectIdsForSchool(
    supabase,
    schoolId,
    insertedSubjectIds,
  );

  if (subjectOwnership.error) {
    return { success: false, error: subjectOwnership.error };
  }

  const assignmentsByClassId = new Map(
    classAssignments.map((row) => [row.classId, row.assignedSubjects]),
  );

  for (const classRow of classesResult.classes) {
    const assignedSubjects = assignmentsByClassId.get(classRow.id) ?? [];

    const { error: deleteAssignmentsError } = await supabase
      .from("class_subjects")
      .delete()
      .eq("class_id", classRow.id);

    if (deleteAssignmentsError) {
      return { success: false, error: deleteAssignmentsError.message };
    }

    if (assignedSubjects.length === 0) {
      continue;
    }

    const rowsToInsert = assignedSubjects
      .map((assignment) => {
        const subjectId = subjectIdByName.get(
          assignment.subjectName.trim().toLowerCase(),
        );

        if (!subjectId) {
          return null;
        }

        return {
          class_id: classRow.id,
          subject_id: subjectId,
          is_elective: assignment.isElective,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    for (const row of rowsToInsert) {
      const classCheck = await verifyOwnedClassIdsForSchool(
        supabase,
        classesResult.academicYear.id,
        [row.class_id],
      );
      const subjectCheck = await verifyOwnedSubjectIdsForSchool(
        supabase,
        schoolId,
        [row.subject_id],
      );

      if (classCheck.error) {
        return { success: false, error: classCheck.error };
      }

      if (subjectCheck.error) {
        return { success: false, error: subjectCheck.error };
      }
    }

    const { error: insertAssignmentsError } = await supabase
      .from("class_subjects")
      .insert(rowsToInsert);

    if (insertAssignmentsError) {
      return { success: false, error: insertAssignmentsError.message };
    }
  }

  revalidatePath("/onboarding", "layout");

  return {
    success: true,
    message: "Subjects saved successfully.",
  };
}
