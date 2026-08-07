import type { CurriculumSnapshot } from "@/lib/curriculum/types";

/** Pure deep-ish copy of curriculum tree for version snapshots. */
export function buildSnapshotJson(tree: CurriculumSnapshot): CurriculumSnapshot {
  return {
    pack: { ...tree.pack },
    units: tree.units.map((u) => ({ ...u })),
    chapters: tree.chapters.map((c) => ({ ...c })),
    topics: tree.topics.map((t) => ({ ...t })),
    subtopics: tree.subtopics.map((s) => ({ ...s })),
    learningOutcomes: tree.learningOutcomes.map((o) => ({ ...o })),
    competencies: tree.competencies.map((c) => ({ ...c })),
    outcomeCompetencies: tree.outcomeCompetencies.map((l) => ({ ...l })),
    resources: tree.resources.map((r) => ({ ...r })),
  };
}
