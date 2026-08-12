"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  listReportCardBlocksAction,
  upsertReportCardBlockAction,
  archiveReportCardBlockAction,
} from "@/lib/report-cards/blocks-actions";
import {
  listReportCardScopesAction,
  upsertReportCardScopeAction,
  archiveReportCardScopeAction,
} from "@/lib/report-cards/scopes-actions";
import {
  cloneReportCardTemplateAsDraftAction,
  listReportCardTemplatesAction,
  publishReportCardTemplateAction,
  retireReportCardTemplateAction,
  upsertReportCardTemplateAction,
} from "@/lib/report-cards/templates-actions";
import { DEFAULT_BLOCK_BLUEPRINT } from "@/lib/report-cards/types";

type TemplateRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  academic_year_id: string | null;
  include_grades: boolean;
  include_attendance: boolean;
  include_behaviour: boolean;
  include_remarks: boolean;
};

type ClassOpt = {
  id: string;
  name: string;
  sections: Array<{ id: string; name: string }>;
};

type Props = {
  years: Array<{ id: string; label: string; isActive: boolean }>;
  academicYearId: string;
  templates: TemplateRow[];
  classes: ClassOpt[];
  canEdit: boolean;
};

export function ReportCardsDesignerClient({
  years,
  academicYearId,
  templates: initial,
  classes,
  canEdit,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState(initial);
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? "");
  const [blocks, setBlocks] = useState<
    Array<{
      id: string;
      block_type: string;
      title: string | null;
      display_order: number;
      is_visible: boolean;
    }>
  >([]);
  const [scopes, setScopes] = useState<
    Array<{
      id: string;
      class_id: string | null;
      section_id: string | null;
      display_order: number;
    }>
  >([]);
  const [name, setName] = useState("");
  const [scopeClassId, setScopeClassId] = useState(classes[0]?.id ?? "");
  const [scopeSectionId, setScopeSectionId] = useState("");

  function run(
    action: () => Promise<{
      success: boolean;
      error?: string;
      message?: string;
      id?: string;
    }>,
  ) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setMessage(result.message ?? "Saved.");
      router.refresh();
    });
  }

  async function loadTemplate(id: string) {
    setSelectedId(id);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const [b, s] = await Promise.all([
        listReportCardBlocksAction(id),
        listReportCardScopesAction(id),
      ]);
      if (!b.success) {
        setError(b.error);
        return;
      }
      if (!s.success) {
        setError(s.error);
        return;
      }
      setBlocks(b.blocks);
      setScopes(s.scopes);
    });
  }

  const selected = templates.find((t) => t.id === selectedId);
  const scopeSections =
    classes.find((c) => c.id === scopeClassId)?.sections ?? [];

  return (
    <div className="space-y-8">
      {message ? (
        <p className="rounded-xl border border-feezy-indigo/20 bg-feezy-indigo/5 px-4 py-3 text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {years.map((y) => (
          <Link
            key={y.id}
            href={`/dashboard/report-cards?year=${y.id}`}
            className={
              y.id === academicYearId
                ? "rounded-lg bg-feezy-indigo px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
            }
          >
            {y.label}
            {y.isActive ? " · active" : ""}
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Templates</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {templates.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No templates yet.</li>
          ) : (
            templates.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <button
                  type="button"
                  className="text-left"
                  onClick={() => loadTemplate(t.id)}
                >
                  <div className="font-medium">
                    {t.name}{" "}
                    <span className="text-xs text-muted">{t.code}</span>
                  </div>
                  <div className="text-xs text-muted">{t.status}</div>
                </button>
                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    {t.status === "draft" ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="text-xs text-feezy-indigo"
                        onClick={() =>
                          run(() => publishReportCardTemplateAction(t.id))
                        }
                      >
                        Publish
                      </button>
                    ) : null}
                    {t.status === "published" ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="text-xs text-muted"
                        onClick={() =>
                          run(() => retireReportCardTemplateAction(t.id))
                        }
                      >
                        Retire
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={pending}
                      className="text-xs text-muted"
                      onClick={() =>
                        run(async () => {
                          const result =
                            await cloneReportCardTemplateAsDraftAction(t.id);
                          if (result.success) {
                            const listed = await listReportCardTemplatesAction({
                              academicYearId,
                            });
                            if (listed.success) {
                              setTemplates(
                                listed.templates as unknown as TemplateRow[],
                              );
                            }
                          }
                          return result;
                        })
                      }
                    >
                      Clone draft
                    </button>
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>

        {canEdit ? (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const result = await upsertReportCardTemplateAction({
                  name,
                  academicYearId,
                  includeGrades: true,
                  includeAttendance: true,
                  includeBehaviour: true,
                  includeRemarks: true,
                });
                if (result.success) {
                  setName("");
                  const listed = await listReportCardTemplatesAction({
                    academicYearId,
                  });
                  if (listed.success) {
                    setTemplates(listed.templates as unknown as TemplateRow[]);
                    if (result.id) {
                      await loadTemplate(result.id);
                    }
                  }
                }
                return result;
              });
            }}
          >
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              New template name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                required
              />
            </label>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="h-10 rounded-lg bg-feezy-magenta px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              Create draft
            </button>
          </form>
        ) : null}
      </section>

      {selectedId ? (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">
            Designer · {selected?.name ?? "Template"}
          </h2>
          <p className="text-sm text-muted">
            Default blueprint has {DEFAULT_BLOCK_BLUEPRINT.length} blocks. Add
            class scopes so this template applies per class/section.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Blocks</h3>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {blocks.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted">
                    No blocks loaded — open a template or create a new draft
                    (seeds blueprint).
                  </li>
                ) : (
                  blocks.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
                    >
                      <span>
                        {b.title ?? b.block_type}
                        <span className="ml-2 text-xs text-muted">
                          #{b.display_order}
                          {!b.is_visible ? " · hidden" : ""}
                        </span>
                      </span>
                      {canEdit && selected?.status === "draft" ? (
                        <button
                          type="button"
                          className="text-xs text-muted"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              const result = await archiveReportCardBlockAction(
                                b.id,
                              );
                              if (result.success) {
                                setBlocks((prev) =>
                                  prev.filter((x) => x.id !== b.id),
                                );
                              }
                              return result;
                            })
                          }
                        >
                          Archive
                        </button>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
              {canEdit && selected?.status === "draft" ? (
                <button
                  type="button"
                  disabled={pending}
                  className="h-9 rounded-lg border border-border px-3 text-xs"
                  onClick={() =>
                    run(async () => {
                      const result = await upsertReportCardBlockAction({
                        templateId: selectedId,
                        blockType: "custom",
                        title: "Custom block",
                        displayOrder: blocks.length + 1,
                        isVisible: true,
                      });
                      if (result.success) {
                        await loadTemplate(selectedId);
                      }
                      return result;
                    })
                  }
                >
                  Add custom block
                </button>
              ) : null}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Class scopes</h3>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {scopes.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted">
                    No class scopes — template is school-wide until scoped.
                  </li>
                ) : (
                  scopes.map((s) => {
                    const cls = classes.find((c) => c.id === s.class_id);
                    const sec = cls?.sections.find((x) => x.id === s.section_id);
                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
                      >
                        <span>
                          {cls?.name ?? "Class"}
                          {sec ? ` · ${sec.name}` : " · all sections"}
                        </span>
                        {canEdit && selected?.status === "draft" ? (
                          <button
                            type="button"
                            className="text-xs text-muted"
                            disabled={pending}
                            onClick={() =>
                              run(async () => {
                                const result =
                                  await archiveReportCardScopeAction(s.id);
                                if (result.success) {
                                  setScopes((prev) =>
                                    prev.filter((x) => x.id !== s.id),
                                  );
                                }
                                return result;
                              })
                            }
                          >
                            Remove
                          </button>
                        ) : null}
                      </li>
                    );
                  })
                )}
              </ul>
              {canEdit && selected?.status === "draft" ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      const result = await upsertReportCardScopeAction({
                        templateId: selectedId,
                        classId: scopeClassId,
                        sectionId: scopeSectionId || null,
                        displayOrder: scopes.length + 1,
                      });
                      if (result.success) {
                        await loadTemplate(selectedId);
                      }
                      return result;
                    });
                  }}
                >
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Class
                    <select
                      value={scopeClassId}
                      onChange={(e) => {
                        setScopeClassId(e.target.value);
                        setScopeSectionId("");
                      }}
                      className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Section
                    <select
                      value={scopeSectionId}
                      onChange={(e) => setScopeSectionId(e.target.value)}
                      className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                    >
                      <option value="">All sections</option>
                      {scopeSections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={pending || !scopeClassId}
                    className="h-9 rounded-lg bg-feezy-indigo px-3 text-xs font-medium text-white disabled:opacity-60"
                  >
                    Add scope
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
