import { slugCode } from "@/lib/config/codes";

export function ensureDepartmentCode(
  name: string,
  code?: string | null,
): string {
  if (code && code.trim()) {
    return slugCode(code.trim(), "DEPT");
  }
  return slugCode(name, "DEPT");
}
