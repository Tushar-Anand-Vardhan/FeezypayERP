import type {
  ModuleCompletionStatus,
  ModuleHealthStatus,
} from "@/lib/config-dashboard/types";

export function completionLabel(status: ModuleCompletionStatus): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "partial":
      return "Partial";
    case "missing":
      return "Missing";
    case "not_applicable":
      return "N/A";
    case "backend_only":
      return "Configured (API)";
    default:
      return status;
  }
}

export function healthLabel(status: ModuleHealthStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "degraded":
      return "Degraded";
    case "critical":
      return "Critical";
    default:
      return "Unknown";
  }
}

export function healthTone(status: ModuleHealthStatus): string {
  switch (status) {
    case "healthy":
      return "text-emerald-700";
    case "degraded":
      return "text-amber-700";
    case "critical":
      return "text-red-700";
    default:
      return "text-muted";
  }
}

export function completionTone(status: ModuleCompletionStatus): string {
  switch (status) {
    case "complete":
    case "backend_only":
      return "text-emerald-700";
    case "partial":
      return "text-amber-700";
    case "missing":
      return "text-red-700";
    default:
      return "text-muted";
  }
}
