"use server";

import { writeGradeCalcAudit } from "@/lib/grade-calculation/audit";
import {
  computeOverallFromSubjects,
  computeSubjectResult,
  defaultGradeBands,
  validateFormulaPartsSum,
} from "@/lib/grade-calculation/compute";
import { fingerprintInputs } from "@/lib/grade-calculation/fingerprint";
import {
  assertFrameworkVersionOwned,
  getActorId,
  loadCategoryAggregateForStudent,
} from "@/lib/grade-calculation/server-helpers";
import type {
  CategoryMarksInput,
  GradeActionResult,
  GraceRulesConfig,
  RunCalcInput,
  StudentSubjectCalcInput,
  SubjectCalcOutput,
} from "@/lib/grade-calculation/types";
import { validateRunCalcInput } from "@/lib/grade-calculation/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function runGradeCalculationAction(
  input: RunCalcInput,
): Promise<GradeActionResult> {
  const fieldErrors = validateRunCalcInput(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext("grade_calculation.run");
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;

  if (
    !(await assertFrameworkVersionOwned(
      supabase,
      schoolId,
      input.assessmentFrameworkId,
      input.assessmentFrameworkVersionId,
    ))
  ) {
    return { success: false, error: "Framework version not found" };
  }

  let resolvedFormulaId = input.formulaId ?? null;
  if (!resolvedFormulaId) {
    const { data: finalFormula } = await supabase
      .from("assessment_framework_formulas")
      .select("id")
      .eq("framework_id", input.assessmentFrameworkId)
      .eq("is_final_grade", true)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    resolvedFormulaId = finalFormula?.id ?? null;
  }

  let formulaParts: Array<{ categoryId: string; weightPercent: number }> = [];
  if (resolvedFormulaId) {
    const { data: parts } = await supabase
      .from("assessment_framework_formula_parts")
      .select("category_id, weight_percent, display_order")
      .eq("framework_id", input.assessmentFrameworkId)
      .eq("formula_id", resolvedFormulaId)
      .is("archived_at", null)
      .order("display_order");
    formulaParts = (parts ?? []).map((p) => ({
      categoryId: p.category_id as string,
      weightPercent: Number(p.weight_percent),
    }));
  }

  // If no formula parts, fall back to category weightages
  if (!formulaParts.length) {
    const { data: cats } = await supabase
      .from("assessment_framework_categories")
      .select("id, weightage_percent, grade_mapping")
      .eq("framework_id", input.assessmentFrameworkId)
      .eq("included_in_final_grade", true)
      .is("archived_at", null);
    formulaParts = (cats ?? [])
      .filter((c) => c.weightage_percent != null)
      .map((c) => ({
        categoryId: c.id as string,
        weightPercent: Number(c.weightage_percent),
      }));
  }

  const sumErr = validateFormulaPartsSum(formulaParts);
  if (sumErr && formulaParts.length) {
    return { success: false, error: sumErr };
  }

  const { data: graceRow } = await supabase
    .from("grade_calculation_grace_rules")
    .select("id, rules")
    .eq("school_id", schoolId)
    .eq("status", "published")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const grace: GraceRulesConfig =
    input.grace ??
    ((graceRow?.rules as GraceRulesConfig) || {
      maxGraceMarks: 0,
      applyTo: "failing_only",
      passPercent: 33,
    });

  const gradeBands = input.gradeBands?.length
    ? input.gradeBands
    : defaultGradeBands();

  // Resolve students: from input (tests) or section roster
  let studentIds: string[] = [];
  if (input.students?.length) {
    studentIds = input.students.map((s) => s.studentProfileId);
  } else if (input.sectionId) {
    const { data: placements } = await supabase
      .from("student_academic_years")
      .select("student_profile_id")
      .eq("section_id", input.sectionId)
      .eq("academic_year_id", input.academicYearId);
    studentIds = (placements ?? [])
      .map((p) => p.student_profile_id as string)
      .filter(Boolean);
  }

  const { data: exemptions } = await supabase
    .from("grade_calculation_exemptions")
    .select("*")
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .is("archived_at", null);

  const { data: optionalSubjects } = await supabase
    .from("grade_calculation_optional_subjects")
    .select("*")
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .eq("class_id", input.classId)
    .is("archived_at", null);

  const subjectResults: SubjectCalcOutput[] = [];
  const subjectId =
    input.subjectId ??
    (
      await supabase
        .from("assessment_frameworks")
        .select("subject_id")
        .eq("id", input.assessmentFrameworkId)
        .maybeSingle()
    ).data?.subject_id;

  if (!subjectId && input.scope === "subject") {
    return { success: false, error: "Subject required" };
  }

  for (const studentProfileId of studentIds) {
    const prebuilt = input.students?.find(
      (s) => s.studentProfileId === studentProfileId,
    );
    if (prebuilt) {
      subjectResults.push(computeSubjectResult(prebuilt));
      continue;
    }

    const subjectExempt = (exemptions ?? []).some(
      (e) =>
        e.student_profile_id === studentProfileId &&
        e.subject_id === subjectId &&
        !e.framework_category_id,
    );

    const categories: CategoryMarksInput[] = [];
    for (const part of formulaParts) {
      const catExempt = (exemptions ?? []).some(
        (e) =>
          e.student_profile_id === studentProfileId &&
          e.framework_category_id === part.categoryId,
      );
      const agg = await loadCategoryAggregateForStudent(
        supabase,
        schoolId,
        part.categoryId,
        studentProfileId,
      );
      categories.push({
        categoryId: part.categoryId,
        obtained: agg?.obtained ?? 0,
        maxMarks: agg?.maxMarks ?? 100,
        markRowIds: agg?.markRowIds ?? [],
        exempt: catExempt || !agg,
      });
    }

    const calcInput: StudentSubjectCalcInput = {
      studentProfileId,
      subjectId: String(subjectId),
      categories,
      formulaParts,
      gradeBands,
      grace,
      subjectExempt,
      passPercent: grace.passPercent ?? 33,
    };
    subjectResults.push(computeSubjectResult(calcInput));
  }

  const excludeFromOverall = new Set(
    (optionalSubjects ?? [])
      .filter((o) => !o.include_in_overall)
      .map((o) => o.subject_id as string),
  );

  const overallByStudent = new Map<string, ReturnType<typeof computeOverallFromSubjects>>();
  if (input.scope === "overall" || input.scope === "term") {
    const byStudent = new Map<string, SubjectCalcOutput[]>();
    for (const r of subjectResults) {
      const list = byStudent.get(r.studentProfileId) ?? [];
      list.push(r);
      byStudent.set(r.studentProfileId, list);
    }
    for (const [sid, list] of byStudent) {
      overallByStudent.set(
        sid,
        computeOverallFromSubjects(list, { excludeSubjectIds: excludeFromOverall }),
      );
    }
  }

  const inputSnapshot = {
    scope: input.scope,
    assessmentFrameworkId: input.assessmentFrameworkId,
    assessmentFrameworkVersionId: input.assessmentFrameworkVersionId,
    formulaId: resolvedFormulaId,
    formulaParts,
    grace,
    gradeBands,
    exemptionIds: (exemptions ?? []).map((e) => e.id),
    optionalSubjectIds: (optionalSubjects ?? []).map((o) => o.id),
    markRowIds: subjectResults.flatMap(
      (r) => (r.breakdown.markRowIds as string[]) ?? [],
    ),
    studentIds,
  };
  const fp = fingerprintInputs(inputSnapshot);
  const actorId = await getActorId(supabase);

  // Supersede prior current runs for same scope key
  await supabase
    .from("grade_calculation_runs")
    .update({ is_current: false, status: "superseded" })
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .eq("class_id", input.classId)
    .eq("scope", input.scope)
    .eq("is_current", true)
    .is("subject_id", input.subjectId ?? null);

  const { data: latest } = await supabase
    .from("grade_calculation_runs")
    .select("run_version")
    .eq("school_id", schoolId)
    .eq("academic_year_id", input.academicYearId)
    .eq("class_id", input.classId)
    .eq("scope", input.scope)
    .order("run_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: run, error: runErr } = await supabase
    .from("grade_calculation_runs")
    .insert({
      school_id: schoolId,
      academic_year_id: input.academicYearId,
      class_id: input.classId,
      section_id: input.sectionId ?? null,
      subject_id: subjectId ?? null,
      term_id: input.termId ?? null,
      assessment_framework_id: input.assessmentFrameworkId,
      assessment_framework_version_id: input.assessmentFrameworkVersionId,
      formula_id: resolvedFormulaId,
      scope: input.scope,
      run_version: (latest?.run_version ?? 0) + 1,
      status: "computed",
      input_snapshot: inputSnapshot,
      inputs_fingerprint: fp,
      change_summary: input.changeSummary?.trim() || null,
      is_current: true,
      computed_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (runErr) return { success: false, error: runErr.message };
  if (!run?.id) return { success: false, error: "Run insert failed" };

  const resultRows: Array<Record<string, unknown>> = [];
  for (const r of subjectResults) {
    resultRows.push({
      school_id: schoolId,
      run_id: run.id,
      student_profile_id: r.studentProfileId,
      result_kind: "subject",
      subject_id: r.subjectId,
      term_id: input.termId ?? null,
      final_marks: r.finalMarks,
      max_marks: r.maxMarks,
      percentage: r.percentage,
      letter_grade: r.letterGrade,
      grade_points: r.gradePoints,
      pass_status: r.passStatus,
      grace_applied: r.graceApplied,
      breakdown: r.breakdown,
      is_current: true,
    });
  }

  if (input.scope === "term" || input.scope === "overall") {
    for (const [, ov] of overallByStudent) {
      resultRows.push({
        school_id: schoolId,
        run_id: run.id,
        student_profile_id: ov.studentProfileId,
        result_kind: input.scope === "term" ? "term" : "overall",
        subject_id: null,
        term_id: input.termId ?? null,
        final_marks: ov.finalMarks,
        max_marks: ov.maxMarks,
        percentage: ov.percentage,
        letter_grade: ov.letterGrade,
        grade_points: ov.gradePoints,
        pass_status: ov.passStatus,
        grace_applied: ov.graceApplied,
        breakdown: ov.breakdown,
        is_current: true,
      });
    }
  }

  if (resultRows.length) {
    const { error: resErr } = await supabase
      .from("grade_calculation_results")
      .insert(resultRows);
    if (resErr) return { success: false, error: resErr.message };
  }

  await writeGradeCalcAudit(supabase, {
    schoolId,
    action: "run.compute",
    entityType: "grade_calculation_run",
    entityId: run.id,
    actorAuthUserId: actorId,
    newValues: {
      fingerprint: fp,
      resultCount: resultRows.length,
      scope: input.scope,
    },
  });

  return {
    success: true,
    id: run.id,
    fingerprint: fp,
    resultCount: resultRows.length,
  };
}

export async function publishGradeCalculationRunAction(
  runId: string,
): Promise<GradeActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "grade_calculation.publish",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const { data: run } = await supabase
    .from("grade_calculation_runs")
    .select("id, status")
    .eq("id", runId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!run) return { success: false, error: "Run not found" };

  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("grade_calculation_runs")
    .update({
      status: "published",
      published_at: now,
      published_by: actorId,
    })
    .eq("id", runId)
    .eq("school_id", schoolId);
  if (error) return { success: false, error: error.message };

  await writeGradeCalcAudit(supabase, {
    schoolId,
    action: "run.publish",
    entityType: "grade_calculation_run",
    entityId: runId,
    actorAuthUserId: actorId,
  });

  return { success: true, id: runId };
}

/** Pure recompute helper exported for smokes via action wrapper */
export async function previewSubjectCalculationAction(
  input: StudentSubjectCalcInput,
): Promise<GradeActionResult> {
  const context = await getAuthenticatedSchoolContext("grade_calculation.run");
  if ("error" in context) return { success: false, error: context.error };
  const result = computeSubjectResult(input);
  return { success: true, result };
}
