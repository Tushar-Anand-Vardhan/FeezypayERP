/** Configuration Dashboard — command centre for school setup. */

export type ModuleCompletionStatus =
  | "complete"
  | "partial"
  | "missing"
  | "not_applicable"
  | "backend_only";

export type ModuleHealthStatus = "healthy" | "degraded" | "critical" | "unknown";

export type ConfigIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
};

export type ConfigModuleId =
  | "school_branding"
  | "academic_calendar"
  | "structure"
  | "subjects"
  | "grading_scales"
  | "houses_clubs"
  | "departments"
  | "timetable"
  | "assessment"
  | "report_cards"
  | "policies"
  | "communications"
  | "editing_framework";

export type ConfigModuleDefinition = {
  id: ConfigModuleId;
  name: string;
  engine: string;
  description: string;
  href: string;
  libPath: string;
  requiredForOnboarding?: boolean;
};

export type ConfigModuleReport = {
  id: ConfigModuleId;
  name: string;
  engine: string;
  description: string;
  href: string;
  libPath: string;
  completion: ModuleCompletionStatus;
  health: ModuleHealthStatus;
  counts: Record<string, number>;
  missing: ConfigIssue[];
  warnings: ConfigIssue[];
  dependencyErrors: ConfigIssue[];
  healthChecks: ConfigIssue[];
};

export type ConfigurationDashboardSummary = {
  overallHealth: ModuleHealthStatus;
  modulesComplete: number;
  modulesPartial: number;
  modulesMissing: number;
  warningCount: number;
  errorCount: number;
  generatedAt: string;
};

export type ConfigurationDashboardResult =
  | {
      success: true;
      summary: ConfigurationDashboardSummary;
      modules: ConfigModuleReport[];
    }
  | { success: false; error: string };
