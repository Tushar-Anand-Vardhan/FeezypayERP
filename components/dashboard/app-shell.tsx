"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  AppHeader,
  type AppHeaderProps,
} from "@/components/dashboard/app-header";
import { AppSidebar } from "@/components/dashboard/app-sidebar";

const COLLAPSED_STORAGE_KEY = "feezy.sidebar.collapsed";

type AppShellProps = AppHeaderProps & {
  children: ReactNode;
};

export function AppShell({ children, ...headerProps }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-full flex-1 bg-background">
      <AppSidebar
        authz={headerProps.authz ?? null}
        onboardingComplete={headerProps.onboardingComplete ?? false}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={toggleCollapsed}
        onMobileOpenChange={setMobileOpen}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          {...headerProps}
          showBrand={false}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        {children}
      </div>
    </div>
  );
}
