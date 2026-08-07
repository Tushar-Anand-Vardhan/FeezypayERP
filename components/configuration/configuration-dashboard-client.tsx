import Link from "next/link";
import {
  completionLabel,
  completionTone,
  healthLabel,
  healthTone,
} from "@/lib/config-dashboard/labels";
import type {
  ConfigModuleReport,
  ConfigurationDashboardSummary,
} from "@/lib/config-dashboard/types";

type Props = {
  summary: ConfigurationDashboardSummary;
  modules: ConfigModuleReport[];
};

function IssueList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ code: string; message: string; severity: string }>;
  empty?: string;
}) {
  if (items.length === 0) {
    return empty ? (
      <p className="text-xs text-muted">{empty}</p>
    ) : null;
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item.code} className="text-sm text-foreground">
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConfigurationDashboardClient({ summary, modules }: Props) {
  return (
    <div className="flex flex-col gap-8">
      <section
        aria-label="Overall health"
        className="grid gap-4 border-b border-border pb-6 sm:grid-cols-4"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Overall
          </p>
          <p className={`mt-1 text-lg font-semibold ${healthTone(summary.overallHealth)}`}>
            {healthLabel(summary.overallHealth)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Modules OK
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {summary.modulesComplete}
            <span className="text-sm font-normal text-muted">
              {" "}
              / {modules.length}
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Warnings
          </p>
          <p className="mt-1 text-lg font-semibold text-amber-700">
            {summary.warningCount}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Errors
          </p>
          <p className="mt-1 text-lg font-semibold text-red-700">
            {summary.errorCount}
          </p>
        </div>
        <p className="sm:col-span-4 text-xs text-muted">
          Generated {new Date(summary.generatedAt).toLocaleString()} · Partial{" "}
          {summary.modulesPartial} · Missing {summary.modulesMissing}
        </p>
      </section>

      <ul className="flex flex-col gap-6">
        {modules.map((mod) => (
          <li
            key={mod.id}
            id={mod.id}
            className="scroll-mt-8 border-b border-border pb-6 last:border-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-feezy-indigo">
                  {mod.engine}
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">
                  <Link
                    href={mod.href}
                    className="underline-offset-2 hover:underline"
                  >
                    {mod.name}
                  </Link>
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-muted">
                  {mod.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className={completionTone(mod.completion)}>
                  {completionLabel(mod.completion)}
                </span>
                <span className={healthTone(mod.health)}>
                  {healthLabel(mod.health)}
                </span>
              </div>
            </div>

            {Object.keys(mod.counts).length > 0 ? (
              <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {Object.entries(mod.counts).map(([key, value]) => (
                  <div key={key} className="flex gap-1">
                    <dt>{key.replaceAll("_", " ")}:</dt>
                    <dd className="font-medium text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <IssueList
                title="Missing configuration"
                items={mod.missing}
                empty="None"
              />
              <IssueList title="Warnings" items={mod.warnings} empty="None" />
              <IssueList
                title="Dependency errors"
                items={mod.dependencyErrors}
                empty="None"
              />
              <IssueList
                title="Health checks"
                items={mod.healthChecks}
                empty="None"
              />
            </div>

            <p className="mt-3 text-xs text-muted">
              <Link href={mod.href} className="text-feezy-indigo hover:underline">
                Open module →
              </Link>
              <span className="mx-2 text-border">·</span>
              <span className="font-mono">{mod.libPath}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
