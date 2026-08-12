import type { createClient } from "@/lib/supabase/server";
import { CONFIG_DASHBOARD_MODULES } from "@/lib/config-dashboard/catalog";
import type {
  ConfigIssue,
  ConfigModuleReport,
  ConfigurationDashboardSummary,
  ModuleCompletionStatus,
  ModuleHealthStatus,
} from "@/lib/config-dashboard/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function countActive(
  supabase: Supabase,
  table: string,
  filters: Record<string, string | boolean | null> = {},
): Promise<number> {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [key, value] of Object.entries(filters)) {
    if (value === null) {
      query = query.is(key, null);
    } else {
      query = query.eq(key, value);
    }
  }
  // Prefer active-only when archived_at exists; ignore error if column missing
  const withArchive = query.is("archived_at", null);
  const { count, error } = await withArchive;
  if (!error) {
    return count ?? 0;
  }
  const retry = supabase.from(table).select("id", { count: "exact", head: true });
  let q = retry;
  for (const [key, value] of Object.entries(filters)) {
    if (value === null) {
      q = q.is(key, null);
    } else {
      q = q.eq(key, value);
    }
  }
  const { count: c2 } = await q;
  return c2 ?? 0;
}

function deriveHealth(
  completion: ModuleCompletionStatus,
  warnings: ConfigIssue[],
  errors: ConfigIssue[],
): ModuleHealthStatus {
  if (errors.length > 0) {
    return "critical";
  }
  if (completion === "missing") {
    return "critical";
  }
  if (warnings.length > 0 || completion === "partial") {
    return "degraded";
  }
  if (completion === "complete" || completion === "backend_only") {
    return "healthy";
  }
  return "unknown";
}

function overallFrom(modules: ConfigModuleReport[]): ModuleHealthStatus {
  if (modules.some((m) => m.health === "critical")) {
    return "critical";
  }
  if (modules.some((m) => m.health === "degraded")) {
    return "degraded";
  }
  if (modules.every((m) => m.health === "healthy")) {
    return "healthy";
  }
  return "unknown";
}

export async function buildConfigurationDashboard(
  supabase: Supabase,
  schoolId: string,
): Promise<{
  summary: ConfigurationDashboardSummary;
  modules: ConfigModuleReport[];
}> {
  const { data: school } = await supabase
    .from("schools")
    .select(
      "name, board, onboarding_status, houses_enabled, clubs_enabled, academic_year_start_month",
    )
    .eq("id", schoolId)
    .maybeSingle();

  const { data: activeYear } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .is("archived_at", null)
    .maybeSingle();

  const yearId = activeYear?.id ?? null;

  const [
    years,
    terms,
    holidays,
    events,
    classes,
    sections,
    subjects,
    subjectGroups,
    gradingScales,
    houses,
    clubs,
    departments,
    grids,
    slots,
    examDefs,
    examTypes,
    rcTemplates,
    rcPublished,
    policies,
    policiesPublished,
    commCategories,
    commTemplates,
    commPublished,
    deliveryRules,
    auditEntries,
    historyRows,
  ] = await Promise.all([
    countActive(supabase, "academic_years", { school_id: schoolId }),
    yearId
      ? countActive(supabase, "terms", { academic_year_id: yearId })
      : Promise.resolve(0),
    yearId
      ? countActive(supabase, "holidays", {
          school_id: schoolId,
          academic_year_id: yearId,
        })
      : Promise.resolve(0),
    yearId
      ? countActive(supabase, "calendar_events", {
          school_id: schoolId,
          academic_year_id: yearId,
        })
      : Promise.resolve(0),
    yearId
      ? countActive(supabase, "classes", { academic_year_id: yearId })
      : Promise.resolve(0),
    yearId
      ? (async () => {
          const { data: classRows } = await supabase
            .from("classes")
            .select("id")
            .eq("academic_year_id", yearId);
          const ids = (classRows ?? []).map((c) => c.id);
          if (ids.length === 0) {
            return 0;
          }
          const { count } = await supabase
            .from("sections")
            .select("id", { count: "exact", head: true })
            .in("class_id", ids);
          return count ?? 0;
        })()
      : Promise.resolve(0),
    countActive(supabase, "subjects", { school_id: schoolId }),
    countActive(supabase, "subject_groups", { school_id: schoolId }),
    countActive(supabase, "grading_scales", { school_id: schoolId }),
    countActive(supabase, "houses", { school_id: schoolId }),
    countActive(supabase, "clubs", { school_id: schoolId }),
    countActive(supabase, "departments", { school_id: schoolId }),
    yearId
      ? countActive(supabase, "timetable_grids", {
          school_id: schoolId,
          academic_year_id: yearId,
        })
      : Promise.resolve(0),
    yearId
      ? (async () => {
          const { data: gridRows } = await supabase
            .from("timetable_grids")
            .select("id")
            .eq("school_id", schoolId)
            .eq("academic_year_id", yearId)
            .is("archived_at", null);
          const gridIds = (gridRows ?? []).map((g) => g.id);
          let gridSlotCount = 0;
          if (gridIds.length > 0) {
            const { count } = await supabase
              .from("timetable_slots")
              .select("id", { count: "exact", head: true })
              .in("grid_id", gridIds)
              .is("archived_at", null);
            gridSlotCount = count ?? 0;
          }
          // Legacy slots (no grid_id) for sections in this year
          const { data: classRows } = await supabase
            .from("classes")
            .select("id")
            .eq("academic_year_id", yearId);
          const classIds = (classRows ?? []).map((c) => c.id);
          if (classIds.length === 0) {
            return gridSlotCount;
          }
          const { data: sectionRows } = await supabase
            .from("sections")
            .select("id")
            .in("class_id", classIds);
          const sectionIds = (sectionRows ?? []).map((s) => s.id);
          if (sectionIds.length === 0) {
            return gridSlotCount;
          }
          const { count: legacyCount } = await supabase
            .from("timetable_slots")
            .select("id", { count: "exact", head: true })
            .in("section_id", sectionIds)
            .is("grid_id", null)
            .is("archived_at", null);
          return gridSlotCount + (legacyCount ?? 0);
        })()
      : Promise.resolve(0),
    yearId
      ? countActive(supabase, "exam_definitions", { academic_year_id: yearId })
      : Promise.resolve(0),
    countActive(supabase, "assessment_exam_types", { school_id: schoolId }),
    countActive(supabase, "report_card_templates", { school_id: schoolId }),
    (async () => {
      const { count } = await supabase
        .from("report_card_templates")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "published")
        .is("archived_at", null);
      return count ?? 0;
    })(),
    countActive(supabase, "school_policies", { school_id: schoolId }),
    (async () => {
      const { count } = await supabase
        .from("school_policies")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "published")
        .is("archived_at", null);
      return count ?? 0;
    })(),
    countActive(supabase, "comm_announcement_categories", {
      school_id: schoolId,
    }),
    countActive(supabase, "comm_message_templates", { school_id: schoolId }),
    (async () => {
      const { count } = await supabase
        .from("comm_message_templates")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "published")
        .is("archived_at", null);
      return count ?? 0;
    })(),
    countActive(supabase, "comm_delivery_rules", { school_id: schoolId }),
    (async () => {
      const { count } = await supabase
        .from("audit_entries")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId);
      return count ?? 0;
    })(),
    (async () => {
      const { count } = await supabase
        .from("config_change_history")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId);
      return count ?? 0;
    })(),
  ]);

  // Dependency checks
  const orphanSlots = await (async () => {
    const { data: archivedSubjects } = await supabase
      .from("subjects")
      .select("id")
      .eq("school_id", schoolId)
      .not("archived_at", "is", null);
    const ids = (archivedSubjects ?? []).map((s) => s.id);
    if (ids.length === 0) {
      return 0;
    }
    const { count } = await supabase
      .from("timetable_slots")
      .select("id", { count: "exact", head: true })
      .in("subject_id", ids)
      .is("archived_at", null);
    return count ?? 0;
  })();

  const publishedRcWithoutBindings = await (async () => {
    const { data: published } = await supabase
      .from("report_card_templates")
      .select("id")
      .eq("school_id", schoolId)
      .eq("status", "published")
      .is("archived_at", null);
    if (!published?.length) {
      return 0;
    }
    let broken = 0;
    for (const tpl of published) {
      const { count } = await supabase
        .from("report_card_template_assessments")
        .select("id", { count: "exact", head: true })
        .eq("template_id", tpl.id)
        .is("archived_at", null);
      if ((count ?? 0) === 0) {
        broken += 1;
      }
    }
    return broken;
  })();

  const reports: ConfigModuleReport[] = CONFIG_DASHBOARD_MODULES.map((mod) => {
    const missing: ConfigIssue[] = [];
    const warnings: ConfigIssue[] = [];
    const dependencyErrors: ConfigIssue[] = [];
    const healthChecks: ConfigIssue[] = [];
    let completion: ModuleCompletionStatus = "missing";
    let counts: Record<string, number> = {};

    switch (mod.id) {
      case "school_branding": {
        counts = {
          has_name: school?.name ? 1 : 0,
          has_board: school?.board ? 1 : 0,
          has_start_month: school?.academic_year_start_month ? 1 : 0,
        };
        if (!school?.name) {
          missing.push({
            code: "branding.name",
            severity: "error",
            message: "School name is not set.",
          });
        }
        if (!school?.academic_year_start_month) {
          missing.push({
            code: "branding.start_month",
            severity: "error",
            message: "Academic year start month is missing.",
          });
        }
        if (!school?.board) {
          warnings.push({
            code: "branding.board",
            severity: "warning",
            message: "Board affiliation is empty.",
          });
        }
        completion =
          missing.length === 0
            ? warnings.length
              ? "partial"
              : "complete"
            : "missing";
        healthChecks.push({
          code: "branding.ok",
          severity: "info",
          message: `Onboarding status: ${school?.onboarding_status ?? "unknown"}`,
        });
        break;
      }
      case "academic_calendar": {
        counts = { years, terms, holidays, events };
        if (years === 0) {
          missing.push({
            code: "calendar.year",
            severity: "error",
            message: "No academic year configured.",
          });
        }
        if (years > 0 && terms === 0) {
          missing.push({
            code: "calendar.terms",
            severity: "error",
            message: "Active year has no terms.",
          });
        }
        if (years > 0 && holidays === 0) {
          warnings.push({
            code: "calendar.holidays",
            severity: "warning",
            message: "No holidays configured for the active year.",
          });
        }
        completion =
          years > 0 && terms > 0
            ? holidays > 0
              ? "complete"
              : "partial"
            : "missing";
        break;
      }
      case "structure": {
        counts = { classes, sections };
        if (classes === 0) {
          missing.push({
            code: "structure.classes",
            severity: "error",
            message: "No classes in the active year.",
          });
        }
        if (classes > 0 && sections === 0) {
          missing.push({
            code: "structure.sections",
            severity: "error",
            message: "Classes exist but no sections.",
          });
        }
        completion =
          classes > 0 && sections > 0
            ? "complete"
            : classes > 0
              ? "partial"
              : "missing";
        break;
      }
      case "subjects": {
        counts = { subjects, subject_groups: subjectGroups };
        if (subjects === 0) {
          missing.push({
            code: "subjects.empty",
            severity: "error",
            message: "No active subjects.",
          });
        }
        if (subjects > 0 && subjectGroups === 0) {
          warnings.push({
            code: "subjects.groups",
            severity: "warning",
            message: "No subject groups defined.",
          });
        }
        if (orphanSlots > 0) {
          dependencyErrors.push({
            code: "subjects.orphan_slots",
            severity: "error",
            message: `${orphanSlots} timetable slot(s) still reference archived subjects.`,
          });
        }
        completion = subjects > 0 ? (subjectGroups > 0 ? "complete" : "partial") : "missing";
        break;
      }
      case "grading_scales": {
        counts = { grading_scales: gradingScales };
        if (gradingScales === 0) {
          warnings.push({
            code: "scales.empty",
            severity: "warning",
            message: "No grading scales — assessments may lack pinned scales.",
          });
          completion = "missing";
        } else {
          completion = "complete";
        }
        break;
      }
      case "houses_clubs": {
        counts = {
          houses,
          clubs,
          houses_enabled: school?.houses_enabled ? 1 : 0,
          clubs_enabled: school?.clubs_enabled ? 1 : 0,
        };
        if (school?.houses_enabled && houses === 0) {
          missing.push({
            code: "houses.empty",
            severity: "error",
            message: "Houses enabled but catalogue is empty.",
          });
        }
        if (school?.clubs_enabled && clubs === 0) {
          missing.push({
            code: "clubs.empty",
            severity: "error",
            message: "Clubs enabled but catalogue is empty.",
          });
        }
        if (!school?.houses_enabled && !school?.clubs_enabled) {
          completion = "not_applicable";
          healthChecks.push({
            code: "houses_clubs.disabled",
            severity: "info",
            message: "Houses and clubs are disabled for this school.",
          });
        } else {
          completion =
            missing.length === 0
              ? houses + clubs > 0
                ? "complete"
                : "partial"
              : "missing";
        }
        break;
      }
      case "departments": {
        counts = { departments };
        if (departments === 0) {
          warnings.push({
            code: "departments.empty",
            severity: "warning",
            message: "No departments — HODs and dept subjects unavailable.",
          });
          completion = "missing";
        } else {
          completion = "complete";
        }
        break;
      }
      case "timetable": {
        counts = { grids, slots };
        if (grids === 0) {
          warnings.push({
            code: "timetable.grids",
            severity: "warning",
            message: "No timetable grids for the active year.",
          });
          completion = "missing";
        } else if (slots === 0) {
          warnings.push({
            code: "timetable.slots",
            severity: "warning",
            message: "Grids exist but no slots scheduled.",
          });
          completion = "partial";
        } else {
          completion = "complete";
        }
        if (orphanSlots > 0) {
          dependencyErrors.push({
            code: "timetable.orphan_subjects",
            severity: "error",
            message: `${orphanSlots} active slot(s) point at archived subjects.`,
          });
        }
        break;
      }
      case "assessment": {
        counts = { exam_types: examTypes, exam_definitions: examDefs };
        if (examTypes === 0) {
          warnings.push({
            code: "assessment.types",
            severity: "warning",
            message: "No exam types seeded.",
          });
        }
        if (examDefs === 0) {
          missing.push({
            code: "assessment.defs",
            severity: "error",
            message: "No exam definitions for the active year.",
          });
          completion = "missing";
        } else {
          completion = "complete";
        }
        break;
      }
      case "report_cards": {
        counts = {
          templates: rcTemplates,
          published: rcPublished,
          published_without_bindings: publishedRcWithoutBindings,
        };
        if (rcTemplates === 0) {
          warnings.push({
            code: "report_cards.empty",
            severity: "warning",
            message: "No report card templates.",
          });
          completion = "missing";
        } else {
          completion = "backend_only";
        }
        if (publishedRcWithoutBindings > 0) {
          dependencyErrors.push({
            code: "report_cards.no_assessments",
            severity: "error",
            message: `${publishedRcWithoutBindings} published template(s) have no assessment bindings.`,
          });
        }
        break;
      }
      case "policies": {
        counts = { policies, published: policiesPublished };
        if (policies === 0) {
          missing.push({
            code: "policies.empty",
            severity: "error",
            message: "No school policies found.",
          });
          completion = "missing";
        } else if (policiesPublished === 0) {
          warnings.push({
            code: "policies.unpublished",
            severity: "warning",
            message: "Policies exist but none are published.",
          });
          completion = "partial";
        } else {
          completion = "backend_only";
        }
        break;
      }
      case "communications": {
        counts = {
          categories: commCategories,
          templates: commTemplates,
          published_templates: commPublished,
          delivery_rules: deliveryRules,
        };
        if (commCategories === 0) {
          warnings.push({
            code: "comm.categories",
            severity: "warning",
            message: "No announcement categories.",
          });
        }
        if (commTemplates === 0) {
          warnings.push({
            code: "comm.templates",
            severity: "warning",
            message: "No message templates.",
          });
          completion = "missing";
        } else if (commPublished === 0) {
          warnings.push({
            code: "comm.unpublished",
            severity: "warning",
            message: "Templates exist but none are published.",
          });
          completion = "partial";
        } else {
          completion = "backend_only";
        }
        healthChecks.push({
          code: "comm.no_send",
          severity: "info",
          message: "Sending is E19 — not enabled. Config only.",
        });
        break;
      }
      case "editing_framework": {
        counts = { audit_entries: auditEntries, history_rows: historyRows };
        completion = "backend_only";
        if (auditEntries === 0 && historyRows === 0) {
          warnings.push({
            code: "editing.unused",
            severity: "warning",
            message:
              "No audit/history rows yet — remaining modules may not call recordConfigMutation.",
          });
        }
        healthChecks.push({
          code: "editing.tables",
          severity: "info",
          message: "audit_entries + config_change_history available.",
        });
        break;
      }
    }

    const health = deriveHealth(completion, warnings, [
      ...missing.filter((m) => m.severity === "error"),
      ...dependencyErrors,
    ]);

    return {
      id: mod.id,
      name: mod.name,
      engine: mod.engine,
      description: mod.description,
      href: mod.href,
      libPath: mod.libPath,
      completion,
      health,
      counts,
      missing,
      warnings,
      dependencyErrors,
      healthChecks,
    };
  });

  const summary: ConfigurationDashboardSummary = {
    overallHealth: overallFrom(reports),
    modulesComplete: reports.filter(
      (m) => m.completion === "complete" || m.completion === "backend_only",
    ).length,
    modulesPartial: reports.filter((m) => m.completion === "partial").length,
    modulesMissing: reports.filter((m) => m.completion === "missing").length,
    warningCount: reports.reduce((n, m) => n + m.warnings.length, 0),
    errorCount: reports.reduce(
      (n, m) =>
        n +
        m.dependencyErrors.length +
        m.missing.filter((i) => i.severity === "error").length,
      0,
    ),
    generatedAt: new Date().toISOString(),
  };

  return { summary, modules: reports };
}
