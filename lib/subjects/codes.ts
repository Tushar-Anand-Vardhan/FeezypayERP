import { slugCode } from "@/lib/config/codes";

export function ensureSubjectGroupCode(
  name: string,
  code?: string | null,
): string {
  if (code && code.trim()) {
    return slugCode(code.trim(), "GRP");
  }
  return slugCode(name, "GRP");
}
