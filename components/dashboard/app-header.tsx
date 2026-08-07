"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { SchoolContextSwitcher } from "@/components/auth/school-context-switcher";
import { SubmitButton } from "@/components/auth/submit-button";
import { Can } from "@/lib/authz/can";
import type { AuthzBootstrap } from "@/lib/authz/bootstrap";
import type { PermissionKey } from "@/lib/authz/catalog";
import { createClient } from "@/lib/supabase/client";
import type { AuthMembership, AuthPersona } from "@/lib/auth/types";

type NavItem = {
  label: string;
  href: string;
  locked?: boolean;
  permission?: PermissionKey;
};

type AppHeaderProps = {
  schoolName?: string | null;
  onboardingComplete?: boolean;
  memberships?: AuthMembership[];
  activeSchoolId?: string | null;
  activePersona?: AuthPersona | null;
  authz?: AuthzBootstrap | null;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard", permission: "tenant.school.read" },
  {
    label: "Principal",
    href: "/dashboard/principal",
    permission: "analytics.dashboard.read",
  },
  {
    label: "Teacher",
    href: "/dashboard/teacher",
    permission: "workforce.workspace.read",
  },
  {
    label: "Student",
    href: "/dashboard/student",
    permission: "enrollment.admission.read",
  },
  {
    label: "Configuration",
    href: "/dashboard/configuration",
    permission: "config.catalog.read",
  },
  {
    label: "Calendar",
    href: "/dashboard/calendar",
    permission: "calendar.year.read",
  },
  {
    label: "Houses & clubs",
    href: "/dashboard/houses-clubs",
    permission: "config.catalog.read",
  },
  {
    label: "Notifications",
    href: "/dashboard/notifications",
    permission: "communication.message.read",
  },
  { label: "Students", href: "#", locked: true, permission: "enrollment.admission.read" },
  { label: "Attendance", href: "#", locked: true, permission: "attendance.record.read" },
  { label: "Reports", href: "#", locked: true, permission: "document.report_card.read" },
  { label: "Settings", href: "#", locked: true, permission: "tenant.school.edit" },
];

export function AppHeader({
  schoolName,
  onboardingComplete = false,
  memberships = [],
  activeSchoolId = null,
  activePersona = null,
  authz = null,
}: AppHeaderProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3.5 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark size="sm" showWordmark />
            {schoolName ? (
              <span className="hidden truncate text-sm text-muted sm:inline">
                {schoolName}
              </span>
            ) : null}
            <SchoolContextSwitcher
              memberships={memberships}
              activeSchoolId={activeSchoolId}
              activePersona={activePersona}
            />
          </div>
          <SubmitButton
            type="button"
            fullWidth={false}
            variant="ghost"
            loading={loading}
            onClick={handleLogout}
          >
            Log out
          </SubmitButton>
        </div>

        <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const locked = Boolean(item.locked) && !onboardingComplete;
            const inner = locked ? (
              <span
                title="Available after onboarding is complete"
                className="cursor-not-allowed rounded-lg px-3 py-1.5 text-sm font-medium text-muted/50"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-strong hover:text-foreground"
              >
                {item.label}
              </Link>
            );

            if (!item.permission || !authz) {
              return <span key={item.label}>{inner}</span>;
            }

            return (
              <Can
                key={item.label}
                permission={item.permission}
                bootstrap={authz}
              >
                {inner}
              </Can>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
