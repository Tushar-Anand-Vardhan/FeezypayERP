/** Stable code helpers for E07 catalogs. */

export function slugCode(raw: string, fallbackPrefix = "ITEM"): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (cleaned.length > 0) {
    return cleaned.slice(0, 32);
  }

  return `${fallbackPrefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function ensureSubjectCode(name: string, code?: string | null): string {
  if (code && code.trim()) {
    return slugCode(code.trim(), "SUB");
  }
  return slugCode(name, "SUB");
}

export function ensureHouseCode(name: string, code?: string | null): string {
  if (code && code.trim()) {
    return slugCode(code.trim(), "HSE");
  }
  return slugCode(name, "HSE");
}

export function ensureClubCode(name: string, code?: string | null): string {
  if (code && code.trim()) {
    return slugCode(code.trim(), "CLB");
  }
  return slugCode(name, "CLB");
}
