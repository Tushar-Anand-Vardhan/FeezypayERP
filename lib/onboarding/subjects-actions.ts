"use server";

import { revalidatePath } from "next/cache";
import { replaceClassSubjectsAction } from "@/lib/config/class-subjects-actions";
import {
  listSubjectsAction,
  syncSubjectsCatalogAction,
} from "@/lib/config/subjects-actions";
import type { SubjectInput } from "@/lib/config/types";
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

function toSubjectInputs(rows: SubjectFormRow[]): SubjectInput[] {
  return trimSubjectRows(rows).map((row) => ({
    name: row.name,
    code: row.code,
    type: row.type,
  }));
}

/** Soft-save catalog only (E07 upsert/archive — no hard delete). */
export async function saveSubjectsAction(
  formData: FormData,
): Promise<SubjectActionResult> {
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

  const result = await syncSubjectsCatalogAction(toSubjectInputs(trimmedSubjects), {
    archiveMissing: true,
  });

  if (!result.success) {
    return result;
  }

  revalidatePath("/onboarding", "layout");
  return { success: true, message: "Subjects saved successfully." };
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

  const subjectsResult = await listSubjectsAction({ includeArchived: false });
  if (!subjectsResult.success) {
    return { success: false, error: subjectsResult.error };
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
    subjects: subjectsResult.subjects.map((row) => ({
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

  const { schoolId } = context;
  const classesResult = await getActiveYearClassesForSchool(
    context.supabase,
    schoolId,
  );

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

  const syncResult = await syncSubjectsCatalogAction(
    toSubjectInputs(trimmedSubjects),
    {
      requireAtLeastOne: intent === "next",
      archiveMissing: true,
    },
  );

  if (!syncResult.success) {
    return syncResult;
  }

  const subjectIdByName = syncResult.subjectIdByName ?? {};
  const assignmentsByClassId = new Map(
    classAssignments.map((row) => [row.classId, row.assignedSubjects]),
  );

  const replaceRows = classesResult.classes.map((classRow) => {
    const assignedSubjects = assignmentsByClassId.get(classRow.id) ?? [];
    return {
      classId: classRow.id,
      assignments: assignedSubjects
        .map((assignment) => {
          const subjectId =
            subjectIdByName[assignment.subjectName.trim().toLowerCase()];
          if (!subjectId) {
            return null;
          }
          return {
            subjectId,
            isElective: assignment.isElective,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null),
    };
  });

  const replaceResult = await replaceClassSubjectsAction(replaceRows);
  if (!replaceResult.success) {
    return replaceResult;
  }

  revalidatePath("/onboarding", "layout");
  return {
    success: true,
    message: "Subjects saved successfully.",
  };
}
