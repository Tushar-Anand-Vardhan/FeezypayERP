import type { ConfigEntityDefinition } from "@/lib/editing/types";

/**
 * Registry of configuration entities across Phase 1 engines.
 * Dependency checks use these declarations — keep in sync when adding catalogs.
 */
export const CONFIG_ENTITY_REGISTRY: Record<string, ConfigEntityDefinition> = {
  subject: {
    entityType: "subject",
    table: "subjects",
    schoolScoped: true,
    strategies: ["R", "K", "M"],
    cosmeticFields: ["name", "description", "display_order", "code"],
    semanticFields: ["type", "category"],
    dependencies: [
      {
        label: "Timetable slots",
        table: "timetable_slots",
        column: "subject_id",
        filters: { archived_at: null },
        blocks: ["hard_delete", "semantic_edit"],
      },
      {
        label: "Exam subject schedules",
        table: "exam_subject_schedules",
        column: "subject_id",
        filters: { archived_at: null },
        blocks: ["hard_delete", "semantic_edit"],
      },
      {
        label: "Class–subject offers",
        table: "class_subjects",
        column: "subject_id",
        blocks: ["hard_delete"],
      },
    ],
  },
  house: {
    entityType: "house",
    table: "houses",
    schoolScoped: true,
    strategies: ["R", "K", "M"],
    cosmeticFields: ["name", "description", "colour", "code", "display_order"],
    dependencies: [
      {
        label: "House memberships",
        table: "house_memberships",
        column: "house_id",
        filters: { archived_at: null },
        blocks: ["hard_delete"],
      },
    ],
  },
  club: {
    entityType: "club",
    table: "clubs",
    schoolScoped: true,
    strategies: ["R", "K", "M"],
    cosmeticFields: ["name", "description", "colour", "code", "display_order"],
    dependencies: [
      {
        label: "Club memberships",
        table: "club_memberships",
        column: "club_id",
        filters: { archived_at: null },
        blocks: ["hard_delete"],
      },
    ],
  },
  grading_scale: {
    entityType: "grading_scale",
    table: "grading_scales",
    schoolScoped: true,
    strategies: ["V", "K", "R"],
    versioned: true,
    cosmeticFields: ["name", "description", "code"],
    dependencies: [
      {
        label: "Grading scale versions",
        table: "grading_scale_versions",
        column: "scale_id",
        blocks: ["hard_delete"],
      },
    ],
  },
  department: {
    entityType: "department",
    table: "departments",
    schoolScoped: true,
    strategies: ["R", "K", "M"],
    cosmeticFields: ["name", "description", "code"],
    dependencies: [
      {
        label: "Department memberships",
        table: "department_memberships",
        column: "department_id",
        filters: { archived_at: null },
        blocks: ["hard_delete", "archive"],
      },
    ],
  },
  exam_definition: {
    entityType: "exam_definition",
    table: "exam_definitions",
    schoolScoped: false,
    strategies: ["M", "X", "V", "K"],
    versioned: true,
    statusField: "publishing_status",
    immutableStatuses: ["published", "locked"],
    cosmeticFields: ["name", "description"],
    semanticFields: [
      "weightage_percent",
      "max_marks",
      "pass_marks",
      "grading_type",
      "category",
    ],
    dependencies: [
      {
        label: "Report card template bindings",
        table: "report_card_template_assessments",
        column: "exam_definition_id",
        filters: { archived_at: null },
        blocks: ["hard_delete", "semantic_edit"],
      },
      {
        label: "Subject schedules",
        table: "exam_subject_schedules",
        column: "exam_definition_id",
        filters: { archived_at: null },
        blocks: ["hard_delete"],
      },
    ],
  },
  report_card_template: {
    entityType: "report_card_template",
    table: "report_card_templates",
    schoolScoped: true,
    strategies: ["V", "X", "K"],
    versioned: true,
    statusField: "status",
    immutableStatuses: ["published", "retired"],
    cosmeticFields: ["name", "description"],
    semanticFields: ["layout_config", "board_id"],
  },
  school_policy: {
    entityType: "school_policy",
    table: "school_policies",
    schoolScoped: true,
    strategies: ["V", "X", "K"],
    versioned: true,
    statusField: "status",
    immutableStatuses: ["published", "retired"],
    cosmeticFields: ["name", "description"],
  },
  message_template: {
    entityType: "message_template",
    table: "comm_message_templates",
    schoolScoped: true,
    strategies: ["V", "X", "K"],
    versioned: true,
    statusField: "status",
    immutableStatuses: ["published", "retired"],
    cosmeticFields: ["name", "description"],
    semanticFields: ["channel"],
  },
  subject_group: {
    entityType: "subject_group",
    table: "subject_groups",
    schoolScoped: true,
    strategies: ["R", "K", "M"],
    cosmeticFields: ["name", "description", "code"],
    dependencies: [
      {
        label: "Subjects in group",
        table: "subjects",
        column: "subject_group_id",
        filters: { archived_at: null },
        blocks: ["hard_delete", "archive"],
      },
    ],
  },
    academic_year: {
    entityType: "academic_year",
    table: "academic_years",
    schoolScoped: true,
    strategies: ["X", "K", "M"],
    statusField: "status",
    immutableStatuses: ["closed"],
    cosmeticFields: ["name", "label"],
    semanticFields: ["start_date", "end_date", "start_month"],
  },
  curriculum: {
    entityType: "curriculum",
    table: "curricula",
    schoolScoped: true,
    strategies: ["V", "K", "M"],
    versioned: true,
    statusField: "status",
    immutableStatuses: ["retired"],
    cosmeticFields: ["name", "description", "code"],
    semanticFields: [
      "academic_year_id",
      "subject_id",
      "class_id",
      "board_id",
      "board_code",
    ],
  },
  curriculum_version: {
    entityType: "curriculum_version",
    table: "curriculum_versions",
    schoolScoped: false,
    strategies: ["V"],
    versioned: true,
    immutableStatuses: ["published"],
    cosmeticFields: ["change_summary"],
  },
  assessment_framework: {
    entityType: "assessment_framework",
    table: "assessment_frameworks",
    schoolScoped: true,
    strategies: ["V", "K", "M"],
    versioned: true,
    statusField: "status",
    immutableStatuses: ["retired"],
    cosmeticFields: ["name", "description", "code"],
    semanticFields: ["academic_year_id", "class_id", "subject_id"],
  },
  assessment_framework_version: {
    entityType: "assessment_framework_version",
    table: "assessment_framework_versions",
    schoolScoped: false,
    strategies: ["V"],
    versioned: true,
    immutableStatuses: ["published"],
    cosmeticFields: ["change_summary"],
  },
};

export function getConfigEntityDefinition(
  entityType: string,
): ConfigEntityDefinition | null {
  return CONFIG_ENTITY_REGISTRY[entityType] ?? null;
}

export function listRegisteredConfigEntities(): string[] {
  return Object.keys(CONFIG_ENTITY_REGISTRY);
}
