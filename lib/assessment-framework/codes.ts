/** Slug helpers for assessment framework codes */

export function slugCode(name: string, fallback = "AF"): string {
  const raw = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return raw || fallback;
}

export function ensureFrameworkCode(name: string, code?: string | null): string {
  if (code?.trim()) return slugCode(code.trim());
  return slugCode(name, "AF");
}

export function ensureCategoryCode(
  name: string,
  code?: string | null,
): string | null {
  if (code?.trim()) return slugCode(code.trim());
  if (!name.trim()) return null;
  return slugCode(name);
}
