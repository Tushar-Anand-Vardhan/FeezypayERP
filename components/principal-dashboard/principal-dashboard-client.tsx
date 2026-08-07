"use client";

import type { PrincipalDashboardAggregate } from "@/lib/principal-dashboard/types";

type Props = {
  dashboard: PrincipalDashboardAggregate;
};

function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

function HealthBadge({
  status,
}: {
  status: "healthy" | "watch" | "critical" | "unknown";
}) {
  const colors: Record<string, string> = {
    healthy: "bg-emerald-100 text-emerald-800",
    watch: "bg-amber-100 text-amber-900",
    critical: "bg-rose-100 text-rose-900",
    unknown: "bg-zinc-100 text-zinc-600",
  };
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${colors[status]}`}
    >
      {status}
    </span>
  );
}

export function PrincipalDashboardClient({ dashboard }: Props) {
  const p = dashboard.panels;
  const health = p.school_health.items;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-6">
        <p className="text-sm text-zinc-500">Principal dashboard</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {dashboard.schoolName ?? "School"} ops
        </h1>
        <p className="text-sm text-zinc-600">
          As of {dashboard.asOfDate}
          {dashboard.academicYearId
            ? ` · year ${dashboard.academicYearId.slice(0, 8)}…`
            : " · no active year"}
          {" · "}
          Overall health <HealthBadge status={health.overall} />
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title={p.school_attendance.name}
          empty={p.school_attendance.empty}
          description={p.school_attendance.description}
        >
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-zinc-500">Present rate</dt>
            <dd className="text-right font-medium">
              {pct(
                p.school_attendance.items.presentRate == null
                  ? null
                  : p.school_attendance.items.presentRate * 100,
              )}
            </dd>
            <dt className="text-zinc-500">Records today</dt>
            <dd className="text-right font-medium">
              {p.school_attendance.items.totalRecords}
            </dd>
            <dt className="text-zinc-500">Sections missing</dt>
            <dd className="text-right font-medium">
              {p.school_attendance.items.sectionsMissingToday}
            </dd>
          </dl>
        </MetricCard>

        <MetricCard
          title={p.teacher_attendance.name}
          empty={p.teacher_attendance.empty}
          description={p.teacher_attendance.description}
        >
          <p className="mb-2 text-xs text-zinc-500">
            {p.teacher_attendance.items.note}
          </p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-zinc-500">Marking completion</dt>
            <dd className="text-right font-medium">
              {pct(
                p.teacher_attendance.items.markingCompletionRate == null
                  ? null
                  : p.teacher_attendance.items.markingCompletionRate * 100,
              )}
            </dd>
            <dt className="text-zinc-500">Teachers who marked</dt>
            <dd className="text-right font-medium">
              {p.teacher_attendance.items.teachersWhoMarkedToday}
            </dd>
            <dt className="text-zinc-500">Active staff</dt>
            <dd className="text-right font-medium">
              {p.teacher_attendance.items.activeEmployments}
            </dd>
          </dl>
        </MetricCard>

        <MetricCard
          title={p.student_performance.name}
          empty={p.student_performance.empty}
          description={p.student_performance.description}
        >
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-zinc-500">Average</dt>
            <dd className="text-right font-medium">
              {pct(p.student_performance.items.averagePercent)}
            </dd>
            <dt className="text-zinc-500">Pass rate</dt>
            <dd className="text-right font-medium">
              {pct(
                p.student_performance.items.passRate == null
                  ? null
                  : p.student_performance.items.passRate * 100,
              )}
            </dd>
            <dt className="text-zinc-500">Published results</dt>
            <dd className="text-right font-medium">
              {p.student_performance.items.publishedResultCount}
            </dd>
          </dl>
        </MetricCard>
      </section>

      <PanelList
        title={p.department_performance.name}
        empty={p.department_performance.empty}
        description={p.department_performance.description}
      >
        <ul className="divide-y divide-zinc-100">
          {p.department_performance.items.map((d) => (
            <li
              key={d.departmentId}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="font-medium text-zinc-900">
                {d.departmentName}
              </span>
              <span className="text-zinc-600">
                {d.memberCount} staff · {d.subjectCount} subjects · avg{" "}
                {pct(d.averagePercent)}
              </span>
            </li>
          ))}
        </ul>
      </PanelList>

      <div className="grid gap-6 lg:grid-cols-2">
        <PanelList
          title={p.upcoming_events.name}
          empty={p.upcoming_events.empty}
          description={p.upcoming_events.description}
        >
          <ul className="divide-y divide-zinc-100">
            {p.upcoming_events.items.map((e) => (
              <li key={e.id} className="py-2 text-sm">
                <div className="font-medium text-zinc-900">{e.title}</div>
                <div className="text-zinc-500">
                  {e.category} · {e.startsAt.slice(0, 16).replace("T", " ")} ·{" "}
                  {e.approvalStatus}
                </div>
              </li>
            ))}
          </ul>
        </PanelList>

        <PanelList
          title={p.pending_approvals.name}
          empty={p.pending_approvals.empty}
          description={p.pending_approvals.description}
        >
          <ul className="divide-y divide-zinc-100">
            {p.pending_approvals.items.map((a) => (
              <li key={`${a.kind}-${a.id}`} className="py-2 text-sm">
                <div className="font-medium text-zinc-900">{a.title}</div>
                <div className="text-zinc-500">
                  {a.kind} · {a.status}
                </div>
              </li>
            ))}
          </ul>
        </PanelList>

        <PanelList
          title={p.pending_report_cards.name}
          empty={p.pending_report_cards.empty}
          description={p.pending_report_cards.description}
        >
          <ul className="divide-y divide-zinc-100">
            {p.pending_report_cards.items.map((r) => (
              <li key={r.id} className="py-2 text-sm">
                <div className="font-medium text-zinc-900">{r.title}</div>
                <div className="text-zinc-500">{r.status}</div>
              </li>
            ))}
          </ul>
        </PanelList>

        <PanelList
          title={p.pending_assessments.name}
          empty={p.pending_assessments.empty}
          description={p.pending_assessments.description}
        >
          <ul className="divide-y divide-zinc-100">
            {p.pending_assessments.items.map((a) => (
              <li key={`${a.kind}-${a.id}`} className="py-2 text-sm">
                <div className="font-medium text-zinc-900">{a.title}</div>
                <div className="text-zinc-500">
                  {a.kind} · {a.status}
                </div>
              </li>
            ))}
          </ul>
        </PanelList>
      </div>

      <PanelList
        title={p.notifications.name}
        empty={p.notifications.empty}
        description={p.notifications.description}
      >
        <ul className="divide-y divide-zinc-100">
          {p.notifications.items.map((n) => (
            <li key={n.id} className="py-2 text-sm">
              <div className="font-medium text-zinc-900">{n.title}</div>
              <div className="text-zinc-500">
                {n.channel} · {n.status} · {n.notificationTypeCode}
              </div>
            </li>
          ))}
        </ul>
      </PanelList>

      <PanelList
        title={p.school_health.name}
        empty={false}
        description={p.school_health.description}
      >
        <ul className="divide-y divide-zinc-100">
          {health.indicators.map((ind) => (
            <li
              key={ind.code}
              className="flex items-start justify-between gap-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium text-zinc-900">{ind.label}</div>
                <div className="text-zinc-500">{ind.detail}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <HealthBadge status={ind.status} />
                <span className="text-zinc-700">
                  {ind.value == null ? "—" : ind.value}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </PanelList>
    </div>
  );
}

function MetricCard({
  title,
  description,
  empty,
  children,
}: {
  title: string;
  description: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      <p className="mt-1 text-xs text-zinc-500">{description}</p>
      <div className="mt-4">
        {empty ? (
          <p className="text-sm text-zinc-400">No data yet.</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function PanelList({
  title,
  description,
  empty,
  children,
}: {
  title: string;
  description: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      <p className="mt-1 text-xs text-zinc-500">{description}</p>
      <div className="mt-3">
        {empty ? (
          <p className="text-sm text-zinc-400">Nothing pending.</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
