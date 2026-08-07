import type { FrameworkSnapshot } from "@/lib/assessment-framework/types";

export function buildFrameworkSnapshotJson(
  tree: FrameworkSnapshot,
): FrameworkSnapshot {
  return {
    framework: { ...tree.framework },
    categories: tree.categories.map((c) => ({ ...c })),
    formulas: tree.formulas.map((f) => ({ ...f })),
    formulaParts: tree.formulaParts.map((p) => ({ ...p })),
  };
}
