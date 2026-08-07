/** Slug helpers for curriculum codes */

export function slugCode(name: string, fallback = "CUR"): string {
  const raw = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return raw || fallback;
}

export function ensureCurriculumCode(name: string, code?: string | null): string {
  if (code?.trim()) return slugCode(code.trim());
  return slugCode(name, "CUR");
}

export function ensureNodeCode(title: string, code?: string | null): string | null {
  if (code?.trim()) return slugCode(code.trim());
  if (!title.trim()) return null;
  return slugCode(title);
}
