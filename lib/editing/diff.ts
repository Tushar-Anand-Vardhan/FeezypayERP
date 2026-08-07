export function computeChangedFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): string[] {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const changed: string[] = [];
  for (const key of keys) {
    const a = before?.[key];
    const b = after?.[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changed.push(key);
    }
  }
  return changed;
}

export function pickChangedValues(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  fields?: string[],
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const changed = fields ?? computeChangedFields(before, after);
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  for (const field of changed) {
    if (before && field in before) {
      oldValues[field] = before[field];
    }
    if (after && field in after) {
      newValues[field] = after[field];
    }
  }
  return { oldValues, newValues };
}
