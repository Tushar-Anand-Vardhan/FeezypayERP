"use server";

import { recordCurriculumPackMutation } from "@/lib/curriculum/audit";
import { ensureCurriculumCode } from "@/lib/curriculum/codes";
import {
  assertClassOwned,
  assertCurriculumOwned,
  assertSubjectOwned,
  assertYearOwned,
  buildSnapshotJson,
  getActorId,
  getCurrentVersion,
  getLatestVersionNumber,
  loadCurriculumTree,
} from "@/lib/curriculum/server-helpers";
import type {
  CloneCurriculumInput,
  CurriculumActionResult,
  CurriculumPackInput,
} from "@/lib/curriculum/types";
import {
  validateCloneInput,
  validatePackInput,
} from "@/lib/curriculum/validation";
import { getAuthenticatedSchoolContext } from "@/lib/onboarding/server-context";

export async function listCurriculaAction(options?: {
  academicYearId?: string;
  subjectId?: string;
  classId?: string;
  includeArchived?: boolean;
}): Promise<
  | { success: true; curricula: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const context = await getAuthenticatedSchoolContext("curriculum.pack.read");
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  let query = supabase
    .from("curricula")
    .select(
      "id, academic_year_id, subject_id, class_id, board_id, board_code, code, name, description, status, suggested_total_hours, archived_at, created_at, updated_at",
    )
    .eq("school_id", schoolId)
    .order("name");

  if (!options?.includeArchived) query = query.is("archived_at", null);
  if (options?.academicYearId) {
    query = query.eq("academic_year_id", options.academicYearId);
  }
  if (options?.subjectId) query = query.eq("subject_id", options.subjectId);
  if (options?.classId) query = query.eq("class_id", options.classId);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, curricula: data ?? [] };
}

export async function createCurriculumAction(
  input: CurriculumPackInput,
): Promise<CurriculumActionResult> {
  const fieldErrors = validatePackInput(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext("curriculum.pack.edit", {
    subjectId: input.subjectId,
  });
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const actorId = await getActorId(supabase);

  if (!(await assertYearOwned(supabase, schoolId, input.academicYearId))) {
    return { success: false, error: "Academic year not found" };
  }
  if (!(await assertSubjectOwned(supabase, schoolId, input.subjectId))) {
    return { success: false, error: "Subject not found" };
  }
  if (!(await assertClassOwned(supabase, schoolId, input.classId))) {
    return { success: false, error: "Class not found" };
  }

  const code = ensureCurriculumCode(input.name, input.code);
  const row = {
    school_id: schoolId,
    academic_year_id: input.academicYearId,
    subject_id: input.subjectId,
    class_id: input.classId,
    board_id: input.boardId ?? null,
    board_code: input.boardCode?.trim() || null,
    code,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    suggested_total_hours: input.suggestedTotalHours ?? null,
    status: "draft",
    created_by: actorId,
    updated_by: actorId,
  };

  const { data, error } = await supabase
    .from("curricula")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data?.id) return { success: false, error: "Insert failed" };

  await recordCurriculumPackMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityId: data.id,
    action: "create",
    after: row,
  });

  return { success: true, id: data.id };
}

export async function updateCurriculumAction(
  curriculumId: string,
  input: Partial<CurriculumPackInput> & { name?: string },
): Promise<CurriculumActionResult> {
  const context = await getAuthenticatedSchoolContext("curriculum.pack.edit");
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertCurriculumOwned(supabase, schoolId, curriculumId);
  if (!owned.ok) return { success: false, error: "Curriculum not found" };

  if (owned.status === "retired") {
    return { success: false, error: "Cannot edit retired curriculum" };
  }

  const actorId = await getActorId(supabase);
  const patch: Record<string, unknown> = {
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  };
  if (input.name != null) patch.name = input.name.trim();
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.boardId !== undefined) patch.board_id = input.boardId;
  if (input.boardCode !== undefined) {
    patch.board_code = input.boardCode?.trim() || null;
  }
  if (input.suggestedTotalHours !== undefined) {
    if (
      input.suggestedTotalHours != null &&
      input.suggestedTotalHours < 0
    ) {
      return {
        success: false,
        error: "Validation failed",
        fieldErrors: { suggestedTotalHours: "Must be ≥ 0" },
      };
    }
    patch.suggested_total_hours = input.suggestedTotalHours;
  }
  if (input.code != null) {
    patch.code = ensureCurriculumCode(input.name ?? String(owned.row?.name), input.code);
  }

  const { error } = await supabase
    .from("curricula")
    .update(patch)
    .eq("id", curriculumId)
    .eq("school_id", schoolId);

  if (error) return { success: false, error: error.message };

  await recordCurriculumPackMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityId: curriculumId,
    action: "update",
    before: owned.row,
    after: { ...owned.row, ...patch },
  });

  return { success: true, id: curriculumId };
}

export async function archiveCurriculumAction(
  curriculumId: string,
): Promise<CurriculumActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "curriculum.pack.archive",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertCurriculumOwned(supabase, schoolId, curriculumId);
  if (!owned.ok) return { success: false, error: "Curriculum not found" };

  const actorId = await getActorId(supabase);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("curricula")
    .update({
      archived_at: now,
      status: "retired",
      updated_by: actorId,
      updated_at: now,
    })
    .eq("id", curriculumId)
    .eq("school_id", schoolId);

  if (error) return { success: false, error: error.message };

  await recordCurriculumPackMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityId: curriculumId,
    action: "archive",
    before: owned.row,
    after: { ...owned.row, archived_at: now, status: "retired" },
  });

  return { success: true, id: curriculumId };
}

export async function retireCurriculumAction(
  curriculumId: string,
): Promise<CurriculumActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "curriculum.pack.archive",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertCurriculumOwned(supabase, schoolId, curriculumId);
  if (!owned.ok) return { success: false, error: "Curriculum not found" };

  const actorId = await getActorId(supabase);
  const { error } = await supabase
    .from("curricula")
    .update({
      status: "retired",
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", curriculumId)
    .eq("school_id", schoolId);

  if (error) return { success: false, error: error.message };

  await recordCurriculumPackMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityId: curriculumId,
    action: "retire",
    before: owned.row,
    after: { ...owned.row, status: "retired" },
  });

  return { success: true, id: curriculumId };
}

export async function publishCurriculumAction(
  curriculumId: string,
  changeSummary?: string,
): Promise<CurriculumActionResult> {
  const context = await getAuthenticatedSchoolContext(
    "curriculum.pack.publish",
  );
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const owned = await assertCurriculumOwned(supabase, schoolId, curriculumId);
  if (!owned.ok) return { success: false, error: "Curriculum not found" };
  if (owned.status === "retired") {
    return { success: false, error: "Cannot publish retired curriculum" };
  }

  const tree = await loadCurriculumTree(supabase, schoolId, curriculumId);
  if (!tree) return { success: false, error: "Failed to load curriculum tree" };

  const actorId = await getActorId(supabase);
  const nextVersion = (await getLatestVersionNumber(supabase, curriculumId)) + 1;
  const snapshot = buildSnapshotJson(tree);
  const now = new Date().toISOString();

  await supabase
    .from("curriculum_versions")
    .update({ is_current: false })
    .eq("curriculum_id", curriculumId)
    .eq("is_current", true);

  const { data: versionRow, error: vErr } = await supabase
    .from("curriculum_versions")
    .insert({
      curriculum_id: curriculumId,
      version: nextVersion,
      snapshot,
      change_summary: changeSummary?.trim() || null,
      published_at: now,
      is_immutable: true,
      is_current: true,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (vErr) return { success: false, error: vErr.message };
  if (!versionRow?.id) return { success: false, error: "Version insert failed" };

  const { error: pErr } = await supabase
    .from("curricula")
    .update({
      status: "published",
      updated_by: actorId,
      updated_at: now,
    })
    .eq("id", curriculumId)
    .eq("school_id", schoolId);

  if (pErr) return { success: false, error: pErr.message };

  await recordCurriculumPackMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityId: curriculumId,
    action: "publish_version",
    before: owned.row,
    after: { ...owned.row, status: "published" },
    versionLabel: `v${nextVersion}`,
    localAction: "publish",
    metadata: { curriculum_version_id: versionRow.id },
  });

  return { success: true, id: curriculumId, versionId: versionRow.id };
}

export async function cloneCurriculumAction(
  input: CloneCurriculumInput,
): Promise<CurriculumActionResult> {
  const fieldErrors = validateCloneInput(input);
  if (Object.keys(fieldErrors).length) {
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const context = await getAuthenticatedSchoolContext("curriculum.pack.clone");
  if ("error" in context) return { success: false, error: context.error };

  const { supabase, schoolId } = context;
  const source = await assertCurriculumOwned(
    supabase,
    schoolId,
    input.sourceCurriculumId,
    { allowArchived: true },
  );
  if (!source.ok || !source.row) {
    return { success: false, error: "Source curriculum not found" };
  }

  if (!(await assertYearOwned(supabase, schoolId, input.targetAcademicYearId))) {
    return { success: false, error: "Target academic year not found" };
  }

  const targetClassId =
    input.targetClassId?.trim() || String(source.row.class_id);
  if (!(await assertClassOwned(supabase, schoolId, targetClassId))) {
    return { success: false, error: "Target class not found" };
  }

  const tree = await loadCurriculumTree(
    supabase,
    schoolId,
    input.sourceCurriculumId,
  );
  if (!tree) return { success: false, error: "Failed to load source tree" };

  const currentVersion = await getCurrentVersion(
    supabase,
    input.sourceCurriculumId,
  );
  const actorId = await getActorId(supabase);
  const name =
    input.name?.trim() ||
    `${String(source.row.name)} (clone)`;
  const code = ensureCurriculumCode(
    name,
    input.code ?? `${String(source.row.code)}_CLONE`,
  );
  const now = new Date().toISOString();

  const { data: newPack, error: packErr } = await supabase
    .from("curricula")
    .insert({
      school_id: schoolId,
      academic_year_id: input.targetAcademicYearId,
      subject_id: source.row.subject_id,
      class_id: targetClassId,
      board_id: source.row.board_id ?? null,
      board_code: source.row.board_code ?? null,
      code,
      name,
      description: source.row.description ?? null,
      suggested_total_hours: source.row.suggested_total_hours ?? null,
      status: "draft",
      cloned_from_curriculum_id: input.sourceCurriculumId,
      cloned_from_version_id: currentVersion?.id ?? null,
      cloned_at: now,
      cloned_by: actorId,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id")
    .maybeSingle();

  if (packErr) return { success: false, error: packErr.message };
  if (!newPack?.id) return { success: false, error: "Clone insert failed" };

  const unitIdMap = new Map<string, string>();
  const chapterIdMap = new Map<string, string>();
  const topicIdMap = new Map<string, string>();
  const subtopicIdMap = new Map<string, string>();
  const loIdMap = new Map<string, string>();
  const compIdMap = new Map<string, string>();

  for (const u of tree.units) {
    const { data } = await supabase
      .from("curriculum_units")
      .insert({
        school_id: schoolId,
        curriculum_id: newPack.id,
        code: u.code,
        title: u.title,
        description: u.description,
        suggested_hours: u.suggested_hours,
        display_order: u.display_order,
      })
      .select("id")
      .maybeSingle();
    if (data?.id) unitIdMap.set(String(u.id), data.id);
  }

  for (const c of tree.chapters) {
    const newUnitId = unitIdMap.get(String(c.unit_id));
    if (!newUnitId) continue;
    const { data } = await supabase
      .from("curriculum_chapters")
      .insert({
        school_id: schoolId,
        curriculum_id: newPack.id,
        unit_id: newUnitId,
        code: c.code,
        title: c.title,
        description: c.description,
        textbook_ref: c.textbook_ref,
        suggested_hours: c.suggested_hours,
        display_order: c.display_order,
      })
      .select("id")
      .maybeSingle();
    if (data?.id) chapterIdMap.set(String(c.id), data.id);
  }

  for (const t of tree.topics) {
    const newChapterId = chapterIdMap.get(String(t.chapter_id));
    if (!newChapterId) continue;
    const { data } = await supabase
      .from("curriculum_topics")
      .insert({
        school_id: schoolId,
        curriculum_id: newPack.id,
        chapter_id: newChapterId,
        code: t.code,
        title: t.title,
        description: t.description,
        suggested_hours: t.suggested_hours,
        display_order: t.display_order,
      })
      .select("id")
      .maybeSingle();
    if (data?.id) topicIdMap.set(String(t.id), data.id);
  }

  for (const s of tree.subtopics) {
    const newTopicId = topicIdMap.get(String(s.topic_id));
    if (!newTopicId) continue;
    const { data } = await supabase
      .from("curriculum_subtopics")
      .insert({
        school_id: schoolId,
        curriculum_id: newPack.id,
        topic_id: newTopicId,
        code: s.code,
        title: s.title,
        description: s.description,
        suggested_hours: s.suggested_hours,
        display_order: s.display_order,
      })
      .select("id")
      .maybeSingle();
    if (data?.id) subtopicIdMap.set(String(s.id), data.id);
  }

  for (const o of tree.learningOutcomes) {
    const { data } = await supabase
      .from("curriculum_learning_outcomes")
      .insert({
        school_id: schoolId,
        curriculum_id: newPack.id,
        unit_id: o.unit_id ? unitIdMap.get(String(o.unit_id)) ?? null : null,
        chapter_id: o.chapter_id
          ? chapterIdMap.get(String(o.chapter_id)) ?? null
          : null,
        topic_id: o.topic_id
          ? topicIdMap.get(String(o.topic_id)) ?? null
          : null,
        subtopic_id: o.subtopic_id
          ? subtopicIdMap.get(String(o.subtopic_id)) ?? null
          : null,
        code: o.code,
        statement: o.statement,
        bloom_level: o.bloom_level,
        display_order: o.display_order,
      })
      .select("id")
      .maybeSingle();
    if (data?.id) loIdMap.set(String(o.id), data.id);
  }

  for (const c of tree.competencies) {
    const { data } = await supabase
      .from("curriculum_competencies")
      .insert({
        school_id: schoolId,
        curriculum_id: newPack.id,
        code: c.code,
        name: c.name,
        framework: c.framework,
        description: c.description,
        display_order: c.display_order,
      })
      .select("id")
      .maybeSingle();
    if (data?.id) compIdMap.set(String(c.id), data.id);
  }

  for (const link of tree.outcomeCompetencies) {
    const loId = loIdMap.get(String(link.learning_outcome_id));
    const compId = compIdMap.get(String(link.competency_id));
    if (!loId || !compId) continue;
    await supabase.from("curriculum_outcome_competencies").insert({
      school_id: schoolId,
      curriculum_id: newPack.id,
      learning_outcome_id: loId,
      competency_id: compId,
    });
  }

  for (const r of tree.resources) {
    await supabase.from("curriculum_resources").insert({
      school_id: schoolId,
      curriculum_id: newPack.id,
      unit_id: r.unit_id ? unitIdMap.get(String(r.unit_id)) ?? null : null,
      chapter_id: r.chapter_id
        ? chapterIdMap.get(String(r.chapter_id)) ?? null
        : null,
      topic_id: r.topic_id ? topicIdMap.get(String(r.topic_id)) ?? null : null,
      subtopic_id: r.subtopic_id
        ? subtopicIdMap.get(String(r.subtopic_id)) ?? null
        : null,
      resource_kind: r.resource_kind,
      title: r.title,
      url: r.url,
      media_id: r.media_id,
      visibility: r.visibility,
      display_order: r.display_order,
      created_by: actorId,
    });
  }

  await recordCurriculumPackMutation(supabase, {
    schoolId,
    authUserId: actorId,
    entityId: newPack.id,
    action: "duplicate",
    after: { id: newPack.id, cloned_from: input.sourceCurriculumId },
    localAction: "clone",
    metadata: {
      source_curriculum_id: input.sourceCurriculumId,
      cloned_from_version_id: currentVersion?.id ?? null,
    },
  });

  return { success: true, id: newPack.id };
}
