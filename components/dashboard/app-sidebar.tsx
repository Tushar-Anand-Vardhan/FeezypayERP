"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import type { AuthzBootstrap } from "@/lib/authz/bootstrap-shared";
import {
  activeDashboardNavGroupId,
  isDashboardNavActive,
  visibleDashboardNavGroups,
  type DashboardNavGroup,
} from "@/lib/dashboard/nav";

const GROUPS_STORAGE_KEY = "feezy.sidebar.groups";

type AppSidebarProps = {
  authz: AuthzBootstrap | null;
  onboardingComplete: boolean;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onMobileOpenChange: (open: boolean) => void;
};

export function AppSidebar({
  authz,
  onboardingComplete,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onMobileOpenChange,
}: AppSidebarProps) {
  const pathname = usePathname() ?? "/dashboard";
  const groups = useMemo(() => visibleDashboardNavGroups(authz), [authz]);
  const activeGroupId = activeDashboardNavGroupId(pathname);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    defaultOpenGroups(groups, activeGroupId),
  );

  useEffect(() => {
    const stored = readStoredGroups();
    const defaults = defaultOpenGroups(groups, activeGroupId);
    setOpenGroups({
      ...defaults,
      ...stored,
      // While setup is incomplete, always keep System open so Settings stays visible.
      ...(!onboardingComplete ? { system: true } : {}),
      ...(activeGroupId ? { [activeGroupId]: true } : {}),
    });
  }, [groups, activeGroupId, onboardingComplete]);

  function toggleGroup(id: string) {
    setOpenGroups((current) => {
      const next = { ...current, [id]: !current[id] };
      try {
        localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function sidebarBody(railCollapsed: boolean) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
          {!railCollapsed ? (
            <BrandMark size="sm" showWordmark href="/dashboard" />
          ) : (
            <BrandMark size="sm" href="/dashboard" />
          )}
          <button
            type="button"
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-strong hover:text-foreground lg:inline-flex"
            aria-label={railCollapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={onToggleCollapsed}
          >
            <CollapseIcon collapsed={railCollapsed} />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-strong lg:hidden"
            aria-label="Close navigation"
            onClick={() => onMobileOpenChange(false)}
          >
            <CloseIcon />
          </button>
        </div>

        <nav
          aria-label="Main"
          className="flex-1 space-y-1 overflow-y-auto px-2 py-3"
        >
          {railCollapsed
            ? null
            : groups.map((group) => {
                const open = Boolean(openGroups[group.id]);
                return (
                  <div key={group.id}>
                    {group.id === "home" ? (
                      <div className="mb-2 space-y-0.5">
                        {group.items.map((item) => (
                          <NavLink
                            key={item.id}
                            item={item}
                            pathname={pathname}
                            onboardingComplete={onboardingComplete}
                            onNavigate={() => onMobileOpenChange(false)}
                          />
                        ))}
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted hover:bg-surface-strong hover:text-foreground"
                          aria-expanded={open}
                          onClick={() => toggleGroup(group.id)}
                        >
                          <span>{group.label}</span>
                          <ChevronIcon open={open} />
                        </button>
                        {open ? (
                          <div className="mb-2 mt-0.5 space-y-0.5">
                            {group.items.map((item) => (
                              <NavLink
                                key={item.id}
                                item={item}
                                pathname={pathname}
                                onboardingComplete={onboardingComplete}
                                onNavigate={() => onMobileOpenChange(false)}
                              />
                            ))}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              })}
        </nav>
      </div>
    );
  }

  return (
    <>
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 border-r border-border bg-surface lg:block ${
          collapsed ? "w-[4.25rem]" : "w-60"
        }`}
      >
        {sidebarBody(collapsed)}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/30"
            aria-label="Close navigation"
            onClick={() => onMobileOpenChange(false)}
          />
          <aside className="relative h-full w-72 max-w-[85vw] bg-surface shadow-xl">
            {sidebarBody(false)}
          </aside>
        </div>
      ) : null}
    </>
  );
}

function NavLink({
  item,
  pathname,
  onboardingComplete,
  onNavigate,
}: {
  item: DashboardNavGroup["items"][number];
  pathname: string;
  onboardingComplete: boolean;
  onNavigate: () => void;
}) {
  // Settings must never render as a locked placeholder (it used to, with href "#").
  const locked =
    item.id !== "settings" &&
    Boolean(item.lockedUntilOnboarding) &&
    !onboardingComplete;
  const active = isDashboardNavActive(item.href, pathname);
  const className = `flex items-center rounded-lg px-2.5 py-2 text-sm font-medium ${
    active
      ? "bg-feezy-indigo/10 text-feezy-indigo"
      : "text-muted hover:bg-surface-strong hover:text-foreground"
  }`;

  if (locked || !item.href || item.href === "#") {
    return (
      <span
        title="Available after onboarding is complete"
        className={`${className} cursor-not-allowed text-muted/50 hover:bg-transparent hover:text-muted/50`}
      >
        {item.label}
      </span>
    );
  }

  return (
    <Link href={item.href} className={className} onClick={onNavigate}>
      {item.label}
    </Link>
  );
}

function defaultOpenGroups(
  groups: DashboardNavGroup[],
  activeGroupId: string | null,
): Record<string, boolean> {
  const open: Record<string, boolean> = {};
  for (const group of groups) {
    // Keep System open so Settings (reset onboarding) is easy to find.
    open[group.id] =
      group.id === "home" ||
      group.id === "system" ||
      group.id === activeGroupId;
  }
  return open;
}

function readStoredGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={`h-3.5 w-3.5 shrink-0 transition ${open ? "rotate-90" : ""}`}
      aria-hidden="true"
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={`h-4 w-4 ${collapsed ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path
        d="M10 3.5L6 8l4 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
