"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  TeacherWorkspaceAggregate,
  TeacherWorkspaceEmployment,
  TeacherWorkspacePanelId,
} from "@/lib/teacher-workspace/types";

type Props = {
  workspace: TeacherWorkspaceAggregate | null;
  employments: TeacherWorkspaceEmployment[];
  selectedEmploymentId: string | null;
  error?: string | null;
};

const PANEL_ORDER: TeacherWorkspacePanelId[] = [
  "todays_timetable",
  "pending_attendance",
  "pending_assessments",
  "homework",
  "announcements",
  "upcoming_events",
  "class_reminders",
  "department_notices",
  "ai_shortcuts",
];

function portalHref(
  path: string,
  employmentId: string | null,
  extra: Record<string, string | null | undefined> = {},
) {
  const params = new URLSearchParams();
  if (employmentId) params.set("employment", employmentId);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function renderItems(
  panelId: TeacherWorkspacePanelId,
  items: unknown,
  employmentId: string | null,
) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-muted">No items from operational data.</p>;
  }

  switch (panelId) {
    case "todays_timetable":
      return (
        <ul className="space-y-2 text-sm">
          {items.map((row) => {
            const r = row as {
              slotId: string;
              periodNumber: number | null;
              startTime: string | null;
              endTime: string | null;
              className: string | null;
              sectionName: string | null;
              subjectName: string | null;
              sectionId: string;
            };
            return (
              <li key={r.slotId}>
                <Link
                  href={portalHref("/dashboard/teacher/attendance", employmentId, {
                    sectionId: r.sectionId,
                  })}
                  className="text-feezy-indigo hover:underline"
                >
                  <span className="font-medium">
                    P{r.periodNumber ?? "?"}
                    {r.startTime ? ` ${r.startTime.slice(0, 5)}` : ""}
                    {r.endTime ? `–${r.endTime.slice(0, 5)}` : ""}
                  </span>
                  <span className="text-muted">
                    {" "}
                    · {[r.className, r.sectionName, r.subjectName]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      );
    case "pending_attendance":
      return (
        <ul className="space-y-2 text-sm">
          {items.map((row) => {
            const r = row as {
              sectionId: string;
              className: string | null;
              sectionName: string | null;
              attendanceDate: string;
            };
            return (
              <li key={`${r.sectionId}-${r.attendanceDate}`}>
                <Link
                  href={portalHref("/dashboard/teacher/attendance", employmentId, {
                    sectionId: r.sectionId,
                    date: r.attendanceDate,
                  })}
                  className="text-feezy-indigo hover:underline"
                >
                  {[r.className, r.sectionName].filter(Boolean).join(" · ") ||
                    r.sectionId}
                  <span className="text-muted"> · {r.attendanceDate}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      );
    case "pending_assessments":
      return (
        <ul className="space-y-2 text-sm">
          {items.map((row) => {
            const r = row as {
              scheduleId: string;
              examDefinitionId: string;
              examName: string;
              subjectId: string | null;
              subjectName: string | null;
              className: string | null;
            };
            return (
              <li key={r.scheduleId}>
                <Link
                  href={portalHref("/dashboard/teacher/marks", employmentId, {
                    scheduleId: r.scheduleId,
                    examDefinitionId: r.examDefinitionId,
                    subjectId: r.subjectId,
                  })}
                  className="text-feezy-indigo hover:underline"
                >
                  <span className="font-medium">{r.examName}</span>
                  <span className="text-muted">
                    {" "}
                    · {[r.className, r.subjectName].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      );
    case "homework":
      return (
        <ul className="space-y-2 text-sm">
          {items.map((row) => {
            const r = row as {
              id: string;
              title: string;
              dueOn: string | null;
              status: string;
            };
            return (
              <li key={r.id}>
                <Link
                  href={portalHref(
                    `/dashboard/teacher/homework/${r.id}`,
                    employmentId,
                  )}
                  className="text-feezy-indigo hover:underline"
                >
                  {r.title}
                  <span className="text-muted">
                    {" "}
                    · {r.status}
                    {r.dueOn ? ` · due ${r.dueOn}` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      );
    case "announcements":
    case "department_notices":
      return (
        <ul className="space-y-3 text-sm">
          {items.map((row) => {
            const r = row as {
              id: string;
              title: string;
              departmentName: string | null;
              body: string;
            };
            return (
              <li key={r.id}>
                <Link
                  href={portalHref(
                    "/dashboard/teacher/announcements",
                    employmentId,
                  )}
                  className="hover:underline"
                >
                  <p className="font-medium text-feezy-indigo">{r.title}</p>
                  <p className="text-muted">
                    {r.departmentName}
                    {r.body ? ` · ${r.body.slice(0, 120)}` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      );
    case "upcoming_events":
      return (
        <ul className="space-y-2 text-sm">
          {items.map((row) => {
            const r = row as {
              id: string;
              title: string;
              category: string;
              startsAt: string;
            };
            return (
              <li key={r.id}>
                <Link
                  href={portalHref("/dashboard/teacher/events", employmentId)}
                  className="text-feezy-indigo hover:underline"
                >
                  <span className="font-medium">{r.title}</span>
                  <span className="text-muted">
                    {" "}
                    · {r.category} · {new Date(r.startsAt).toLocaleString()}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      );
    case "class_reminders":
      return (
        <ul className="space-y-2 text-sm">
          {items.map((row) => {
            const r = row as {
              id: string;
              kind: string;
              title: string;
              whenLabel: string;
              sectionId?: string | null;
            };
            const href =
              r.kind === "period" && r.sectionId
                ? portalHref("/dashboard/teacher/attendance", employmentId, {
                    sectionId: r.sectionId,
                  })
                : portalHref("/dashboard/teacher/events", employmentId);
            return (
              <li key={`${r.kind}-${r.id}`}>
                <Link href={href} className="text-feezy-indigo hover:underline">
                  <span className="font-medium">{r.title || "(untitled)"}</span>
                  <span className="text-muted">
                    {" "}
                    · {r.kind} · {r.whenLabel}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      );
    case "ai_shortcuts":
      return (
        <ul className="space-y-2 text-sm">
          {items.map((row) => {
            const r = row as {
              serviceId: string;
              label: string;
              status: string;
            };
            return (
              <li key={r.serviceId}>
                {r.label}
                <span className="font-mono text-xs text-muted">
                  {" "}
                  · {r.serviceId} · {r.status}
                </span>
              </li>
            );
          })}
        </ul>
      );
    default:
      return (
        <pre className="overflow-x-auto text-xs text-muted">
          {JSON.stringify(items, null, 2)}
        </pre>
      );
  }
}

export function TeacherWorkspaceClient({
  workspace,
  employments,
  selectedEmploymentId,
  error,
}: Props) {
  const router = useRouter();

  function onEmploymentChange(id: string) {
    const params = new URLSearchParams();
    if (id) params.set("employment", id);
    router.push(`/dashboard/teacher?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Teacher
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {workspace?.employment.fullName ?? "Select employment"}
          </p>
          {workspace ? (
            <p className="mt-1 text-sm text-muted">
              {workspace.employment.designation ?? "Teacher"}
              {workspace.employment.isHod ? " · HOD" : ""}
              {" · "}
              {workspace.asOfDate} (weekday {workspace.dayOfWeek})
            </p>
          ) : null}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Employment
          </span>
          <select
            className="min-w-[220px] rounded-lg border border-border bg-surface px-3 py-2"
            value={selectedEmploymentId ?? ""}
            onChange={(e) => onEmploymentChange(e.target.value)}
          >
            {employments.length === 0 ? (
              <option value="">No active employments</option>
            ) : null}
            {employments.map((e) => (
              <option key={e.employmentId} value={e.employmentId}>
                {e.fullName || e.employmentId}
                {e.designation ? ` — ${e.designation}` : ""}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {!workspace ? (
        <p className="text-sm text-muted">
          No workspace to show. Add staff employments in onboarding, then
          reopen this page.{" "}
          <Link href="/onboarding/staff" className="text-feezy-indigo underline">
            Staff onboarding
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-8">
          {PANEL_ORDER.map((id) => {
            const panel = workspace.panels[id];
            return (
              <li
                key={id}
                id={id}
                className="scroll-mt-8 border-b border-border pb-6 last:border-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-semibold tracking-tight">
                      {panel.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted">{panel.description}</p>
                  </div>
                  <span className="text-xs text-muted">
                    {panel.empty ? "Empty" : "From data"}
                  </span>
                </div>
                <div className="mt-4">
                  {renderItems(id, panel.items, selectedEmploymentId)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
