"use server";

import { revalidatePath } from "next/cache";
import { assembleReportCardFromSources } from "@/lib/report-cards/assemble";
import {
  assertStudentInSchool,
  loadCurrentVersion,
  loadIssue,
  nextVersionNumber,
  writeReportCardAudit,
} from "@/lib/report-cards/ops-server-helpers";
import type {
  CreateReportCardDraftInput,
  FillReportCardFieldsInput,
  IssueReportCardInput,
  LockReportCardInput,
  RegenerateReportCardInput,
  ReportCardOpsActionResult,
  UpdateReportCardRemarksInput,
} from "@/lib/report-cards/ops-types";
import { isPublishedStatus } from "@/lib/report-cards/ops-types";
import {
  mayEditRemarks,
  mayFillFields,
  mayLockIssue,
  mayPublishVersion,
  mayRegenerateVersion,
  validateCreateDraftInput,
  validateFillFieldsInput,
  validateIssueInput,
  validateUpdateRemarksInput,
} from "@/lib/report-cards/ops-validation";
import {
  assertTemplateOwned,
  assertTermInYear,
  assertYearOwned,
  getActorId,
} from "@/lib/report-cards/server-helpers";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

function revalidate() {
  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/report-cards");
}

export async function createReportCardDraftAction(
  input: CreateReportCardDraftInput,
): Promise<ReportCardOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("document.report_card.issue");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateCreateDraftInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found." };
  }
  if (
    input.termId &&
    !(await assertTermInYear(supabase, input.academicYearId, input.termId))
  ) {
    return { success: false, error: "Term not found in year." };
  }
  const template = await assertTemplateOwned(
    supabase,
    schoolId,
    input.templateId,
  );
  if (!template.ok) {
    return { success: false, error: "Template not found." };
  }
  if (
    !(await assertStudentInSchool(supabase, schoolId, input.studentProfileId))
  ) {
    return { success: false, error: "Student not found in this school." };
  }

  const assembled = await assembleReportCardFromSources(supabase, {
    schoolId,
    studentProfileId: input.studentProfileId,
    academicYearId: input.academicYearId,
    templateId: input.templateId,
    termId: input.termId,
    teacherRemarks: input.teacherRemarks,
    principalRemarks: input.principalRemarks,
  });
  if ("error" in assembled) {
    return { success: false, error: assembled.error };
  }

  const title =
    input.title?.trim() ||
    `Report card — ${assembled.presentation.student.fullName ?? "student"}`;

  const { data: issue, error: issueError } = await supabase
    .from("report_card_issues")
    .insert({
      school_id: schoolId,
      student_profile_id: input.studentProfileId,
      student_academic_year_id:
        assembled.sourceRefs.studentAcademicYearId,
      academic_year_id: input.academicYearId,
      term_id: input.termId ?? null,
      template_id: input.templateId,
      status: "draft",
      title,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (issueError || !issue) {
    return {
      success: false,
      error: issueError?.message ?? "Failed to create report card issue.",
    };
  }

  const { data: version, error: versionError } = await supabase
    .from("report_card_issue_versions")
    .insert({
      school_id: schoolId,
      issue_id: issue.id,
      version: 1,
      status: "draft",
      template_version_id: assembled.sourceRefs.templateVersionId,
      source_refs: assembled.sourceRefs,
      presentation_snapshot: assembled.presentation,
      teacher_remarks: input.teacherRemarks ?? null,
      principal_remarks: input.principalRemarks ?? null,
      promotion_status: assembled.presentation.promotionStatus,
      grade_calculation_run_ids: assembled.sourceRefs.gradeCalculationRunIds,
      field_values: {},
      generated_by: actorId,
    })
    .select("id, version")
    .maybeSingle();

  if (versionError || !version) {
    await supabase
      .from("report_card_issues")
      .update({
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", issue.id);
    return {
      success: false,
      error: versionError?.message ?? "Failed to create draft version.",
    };
  }

  await supabase
    .from("report_card_issues")
    .update({
      current_version_id: version.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", issue.id);

  await writeReportCardAudit(supabase, {
    schoolId,
    action: "report_card.draft_created",
    actorId,
    issueId: issue.id,
    issueVersionId: version.id,
    studentProfileId: input.studentProfileId,
    newValues: {
      exam_result_count: assembled.sourceRefs.examResultIds.length,
      grade_run_count: assembled.sourceRefs.gradeCalculationRunIds.length,
      template_version_id: assembled.sourceRefs.templateVersionId,
    },
  });

  revalidate();
  return {
    success: true,
    message: "Report card draft generated from source data.",
    issueId: issue.id,
    versionId: version.id,
    version: version.version,
  };
}

export async function regenerateReportCardDraftAction(
  input: RegenerateReportCardInput,
): Promise<ReportCardOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("document.report_card.issue");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const issue = await loadIssue(supabase, schoolId, input.issueId);
  if (!issue) {
    return { success: false, error: "Report card issue not found." };
  }
  if (issue.status === "revoked" || issue.status === "locked") {
    return {
      success: false,
      error: "Revoked or locked cards cannot be regenerated.",
    };
  }

  const current = await loadCurrentVersion(supabase, schoolId, issue);
  const createNewVersion =
    Boolean(input.asNewVersion) ||
    (current && !mayRegenerateVersion(current.status as string));

  if (current && !createNewVersion && !mayRegenerateVersion(current.status as string)) {
    return {
      success: false,
      error:
        "Current version is published/locked — pass asNewVersion to create a reissue draft.",
    };
  }

  const priorFieldValues =
    (current?.field_values as Record<string, string | null> | null) ?? {};

  const assembled = await assembleReportCardFromSources(supabase, {
    schoolId,
    studentProfileId: issue.student_profile_id,
    academicYearId: issue.academic_year_id,
    templateId: issue.template_id,
    termId: issue.term_id,
    teacherRemarks: (current?.teacher_remarks as string | null) ?? null,
    principalRemarks: (current?.principal_remarks as string | null) ?? null,
    fieldValues: priorFieldValues,
  });
  if ("error" in assembled) {
    return { success: false, error: assembled.error };
  }

  const now = new Date().toISOString();

  if (current && !createNewVersion) {
    const { error } = await supabase
      .from("report_card_issue_versions")
      .update({
        source_refs: assembled.sourceRefs,
        presentation_snapshot: {
          ...assembled.presentation,
          teacherRemarks: current.teacher_remarks,
          principalRemarks: current.principal_remarks,
          fieldValues: priorFieldValues,
        },
        template_version_id: assembled.sourceRefs.templateVersionId,
        promotion_status: assembled.presentation.promotionStatus,
        grade_calculation_run_ids: assembled.sourceRefs.gradeCalculationRunIds,
        generated_at: now,
        generated_by: actorId,
        updated_at: now,
      })
      .eq("id", current.id);

    if (error) {
      return { success: false, error: error.message };
    }

    await writeReportCardAudit(supabase, {
      schoolId,
      action: "report_card.draft_regenerated",
      actorId,
      issueId: issue.id,
      issueVersionId: current.id,
      studentProfileId: issue.student_profile_id,
    });

    revalidate();
    return {
      success: true,
      message: "Draft regenerated from live source data.",
      issueId: issue.id,
      versionId: current.id,
      version: current.version as number,
    };
  }

  // New version path (reissue draft)
  if (current && isPublishedStatus(current.status as string)) {
    await supabase
      .from("report_card_issue_versions")
      .update({
        status: "superseded",
        superseded_at: now,
        updated_at: now,
      })
      .eq("id", current.id);
  }

  const versionNum = await nextVersionNumber(supabase, issue.id);
  const { data: version, error: versionError } = await supabase
    .from("report_card_issue_versions")
    .insert({
      school_id: schoolId,
      issue_id: issue.id,
      version: versionNum,
      status: "draft",
      template_version_id: assembled.sourceRefs.templateVersionId,
      source_refs: assembled.sourceRefs,
      presentation_snapshot: {
        ...assembled.presentation,
        teacherRemarks: current?.teacher_remarks ?? null,
        principalRemarks: current?.principal_remarks ?? null,
        fieldValues: priorFieldValues,
      },
      teacher_remarks: (current?.teacher_remarks as string | null) ?? null,
      principal_remarks: (current?.principal_remarks as string | null) ?? null,
      promotion_status: assembled.presentation.promotionStatus,
      grade_calculation_run_ids: assembled.sourceRefs.gradeCalculationRunIds,
      field_values: priorFieldValues,
      generated_by: actorId,
    })
    .select("id, version")
    .maybeSingle();

  if (versionError || !version) {
    return {
      success: false,
      error: versionError?.message ?? "Failed to create new version.",
    };
  }

  await supabase
    .from("report_card_issues")
    .update({
      current_version_id: version.id,
      status: "draft",
      updated_at: now,
    })
    .eq("id", issue.id);

  await writeReportCardAudit(supabase, {
    schoolId,
    action: "report_card.version_opened",
    actorId,
    issueId: issue.id,
    issueVersionId: version.id,
    studentProfileId: issue.student_profile_id,
    newValues: { version: version.version },
  });

  revalidate();
  return {
    success: true,
    message: `Version ${version.version} draft opened from source data.`,
    issueId: issue.id,
    versionId: version.id,
    version: version.version,
  };
}

export async function updateReportCardRemarksAction(
  input: UpdateReportCardRemarksInput,
): Promise<ReportCardOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("document.report_card.issue");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateUpdateRemarksInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const issue = await loadIssue(supabase, schoolId, input.issueId);
  if (!issue) {
    return { success: false, error: "Report card issue not found." };
  }
  const current = await loadCurrentVersion(supabase, schoolId, issue);
  if (!current) {
    return { success: false, error: "Current version not found." };
  }
  if (!mayEditRemarks(current.status as string, issue.status as string)) {
    return {
      success: false,
      error: "Remarks can only be edited on a draft version.",
    };
  }

  const teacherRemarks =
    input.teacherRemarks === undefined
      ? current.teacher_remarks
      : input.teacherRemarks;
  const principalRemarks =
    input.principalRemarks === undefined
      ? current.principal_remarks
      : input.principalRemarks;

  const snap = {
    ...(current.presentation_snapshot as Record<string, unknown>),
    teacherRemarks,
    principalRemarks,
  };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("report_card_issue_versions")
    .update({
      teacher_remarks: teacherRemarks,
      principal_remarks: principalRemarks,
      presentation_snapshot: snap,
      updated_at: now,
    })
    .eq("id", current.id);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeReportCardAudit(supabase, {
    schoolId,
    action: "report_card.remarks_updated",
    actorId,
    issueId: issue.id,
    issueVersionId: current.id,
    studentProfileId: issue.student_profile_id,
  });

  revalidate();
  return {
    success: true,
    message: "Remarks updated.",
    issueId: issue.id,
    versionId: current.id,
  };
}

export async function issueReportCardAction(
  input: IssueReportCardInput,
): Promise<ReportCardOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("document.report_card.issue");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateIssueInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const issue = await loadIssue(supabase, schoolId, input.issueId);
  if (!issue) {
    return { success: false, error: "Report card issue not found." };
  }
  if (issue.status === "revoked") {
    return { success: false, error: "Cannot issue a revoked card." };
  }

  const current = await loadCurrentVersion(supabase, schoolId, issue);
  if (
    !current ||
    !mayPublishVersion(current.status as string, issue.status as string)
  ) {
    return { success: false, error: "Only a draft version can be published." };
  }

  const now = new Date().toISOString();
  const issuedOn = now.slice(0, 10);

  const { error: versionError } = await supabase
    .from("report_card_issue_versions")
    .update({
      status: "published",
      issued_at: now,
      issued_by: actorId,
      notes: input.notes ?? null,
      updated_at: now,
    })
    .eq("id", current.id);

  if (versionError) {
    return { success: false, error: versionError.message };
  }

  const { error: issueError } = await supabase
    .from("report_card_issues")
    .update({
      status: "published",
      issued_at: now,
      issued_by: actorId,
      updated_at: now,
    })
    .eq("id", issue.id);

  if (issueError) {
    return { success: false, error: issueError.message };
  }

  // Mirror into student_issued_documents for Student Profile aggregator
  const { data: existingDoc } = await supabase
    .from("student_issued_documents")
    .select("id")
    .eq("report_card_issue_id", issue.id)
    .is("archived_at", null)
    .maybeSingle();

  if (existingDoc) {
    await supabase
      .from("student_issued_documents")
      .update({
        status: "issued",
        issued_on: issuedOn,
        title: issue.title,
        template_id: issue.template_id,
        template_version_id: current.template_version_id,
        report_card_issue_version_id: current.id,
        academic_year_id: issue.academic_year_id,
        updated_at: now,
      })
      .eq("id", existingDoc.id);
  } else {
    await supabase.from("student_issued_documents").insert({
      school_id: schoolId,
      student_profile_id: issue.student_profile_id,
      document_kind: "report_card",
      title: issue.title,
      template_id: issue.template_id,
      template_version_id: current.template_version_id,
      report_card_issue_id: issue.id,
      report_card_issue_version_id: current.id,
      academic_year_id: issue.academic_year_id,
      issued_on: issuedOn,
      status: "issued",
    });
  }

  // Queue PDF render job stub (no bytes yet)
  if (current.template_version_id) {
    await supabase.from("report_card_render_jobs").insert({
      school_id: schoolId,
      template_version_id: current.template_version_id,
      report_card_issue_version_id: current.id,
      status: "queued",
    });
  }

  await writeReportCardAudit(supabase, {
    schoolId,
    action: "report_card.published",
    actorId,
    issueId: issue.id,
    issueVersionId: current.id,
    studentProfileId: issue.student_profile_id,
    newValues: { version: current.version },
  });

  const { emitDomainEvent } = await import("@/lib/domain-events/emit");
  await emitDomainEvent(supabase, {
    schoolId,
    eventType: "document.artifact.issued",
    aggregateType: "report_card_issue",
    aggregateId: issue.id,
    payload: {
      studentProfileId: issue.student_profile_id,
      title: issue.title,
      issueVersionId: current.id,
      documentKind: "report_card",
    },
    idempotencyKey: `document.artifact.issued:${issue.id}:${current.id}`,
  });

  revalidate();
  return {
    success: true,
    message: "Report card published (version frozen).",
    issueId: issue.id,
    versionId: current.id,
    version: current.version as number,
  };
}

/** @deprecated Alias — prefer publish semantics (status=published). */
export async function publishReportCardAction(
  input: IssueReportCardInput,
): Promise<ReportCardOpsActionResult> {
  return issueReportCardAction(input);
}

export async function fillReportCardFieldsAction(
  input: FillReportCardFieldsInput,
): Promise<ReportCardOpsActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "document.report_card.fill",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const fieldErrors = validateFillFieldsInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const issue = await loadIssue(supabase, schoolId, input.issueId);
  if (!issue) {
    return { success: false, error: "Report card issue not found." };
  }
  const current = await loadCurrentVersion(supabase, schoolId, issue);
  if (!current) {
    return { success: false, error: "Current version not found." };
  }
  if (!mayFillFields(current.status as string, issue.status as string)) {
    return {
      success: false,
      error: "Fields can only be filled on a draft version.",
    };
  }

  const { data: assignments } = await supabase
    .from("report_card_template_field_assignments")
    .select("field_key, max_length, required")
    .eq("template_id", issue.template_id)
    .eq("school_id", schoolId)
    .is("archived_at", null);

  const allowed = new Map(
    (assignments ?? []).map((a) => [
      a.field_key as string,
      a as { field_key: string; max_length: number; required: boolean },
    ]),
  );

  if (allowed.size === 0) {
    return {
      success: false,
      error: "Template has no assigned fillable fields.",
    };
  }

  const nextValues: Record<string, string | null> = {
    ...((current.field_values as Record<string, string | null> | null) ?? {}),
  };

  for (const [key, value] of Object.entries(input.fields)) {
    const meta = allowed.get(key);
    if (!meta) {
      return {
        success: false,
        error: `Field "${key}" is not assigned on this template.`,
      };
    }
    if (value != null && value.length > Number(meta.max_length)) {
      return {
        success: false,
        error: `Field "${key}" exceeds max length (${meta.max_length}).`,
      };
    }
    nextValues[key] = value;
  }

  const snap = {
    ...(current.presentation_snapshot as Record<string, unknown>),
    fieldValues: nextValues,
  };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("report_card_issue_versions")
    .update({
      field_values: nextValues,
      presentation_snapshot: snap,
      updated_at: now,
    })
    .eq("id", current.id);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeReportCardAudit(supabase, {
    schoolId,
    action: "report_card.fields_filled",
    actorId,
    issueId: issue.id,
    issueVersionId: current.id,
    studentProfileId: issue.student_profile_id,
    newValues: { keys: Object.keys(input.fields) },
  });

  revalidate();
  return {
    success: true,
    message: "Assigned fields updated.",
    issueId: issue.id,
    versionId: current.id,
  };
}

export async function lockReportCardAction(
  input: LockReportCardInput,
): Promise<ReportCardOpsActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "document.report_card.lock",
  );
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  if (!input.issueId?.trim()) {
    return { success: false, error: "Issue id is required." };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const issue = await loadIssue(supabase, schoolId, input.issueId);
  if (!issue) {
    return { success: false, error: "Report card issue not found." };
  }
  if (!mayLockIssue(issue.status as string)) {
    return {
      success: false,
      error: "Only a published card can be locked.",
    };
  }

  const current = await loadCurrentVersion(supabase, schoolId, issue);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("report_card_issues")
    .update({
      status: "locked",
      locked_at: now,
      locked_by: actorId,
      updated_at: now,
    })
    .eq("id", issue.id);

  if (error) {
    return { success: false, error: error.message };
  }

  if (current) {
    await supabase
      .from("report_card_issue_versions")
      .update({
        status: "locked",
        locked_at: now,
        locked_by: actorId,
        updated_at: now,
      })
      .eq("id", current.id);
  }

  await writeReportCardAudit(supabase, {
    schoolId,
    action: "report_card.locked",
    actorId,
    issueId: issue.id,
    issueVersionId: current?.id ?? null,
    studentProfileId: issue.student_profile_id,
  });

  revalidate();
  return {
    success: true,
    message: "Report card locked.",
    issueId: issue.id,
    versionId: current?.id,
  };
}

export async function revokeReportCardAction(
  issueId: string,
): Promise<ReportCardOpsActionResult> {
  const context = await getAuthenticatedSchoolContext("document.report_card.issue");
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);
  const issue = await loadIssue(supabase, schoolId, issueId);
  if (!issue) {
    return { success: false, error: "Report card issue not found." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("report_card_issues")
    .update({
      status: "revoked",
      revoked_at: now,
      revoked_by: actorId,
      updated_at: now,
    })
    .eq("id", issueId);

  if (error) {
    return { success: false, error: error.message };
  }

  if (issue.current_version_id) {
    await supabase
      .from("report_card_issue_versions")
      .update({
        status: "revoked",
        updated_at: now,
      })
      .eq("id", issue.current_version_id)
      .in("status", ["issued", "published", "locked"]);
  }

  await supabase
    .from("student_issued_documents")
    .update({ status: "revoked", updated_at: now })
    .eq("report_card_issue_id", issueId);

  await writeReportCardAudit(supabase, {
    schoolId,
    action: "report_card.revoked",
    actorId,
    issueId,
    studentProfileId: issue.student_profile_id,
  });

  revalidate();
  return { success: true, message: "Report card revoked.", issueId };
}
