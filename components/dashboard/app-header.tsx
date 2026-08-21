"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { SchoolContextSwitcher } from "@/components/auth/school-context-switcher";
import { SubmitButton } from "@/components/auth/submit-button";
import { createClient } from "@/lib/supabase/client";
import type { AuthzBootstrap } from "@/lib/authz/bootstrap-shared";
import type { AuthMembership, AuthPersona } from "@/lib/auth/types";

export type AppHeaderProps = {
  schoolName?: string | null;
  onboardingComplete?: boolean;
  memberships?: AuthMembership[];
  activeSchoolId?: string | null;
  activePersona?: AuthPersona | null;
  authz?: AuthzBootstrap | null;
  showBrand?: boolean;
  showSettingsLink?: boolean;
  onOpenMobileNav?: () => void;
};

export function AppHeader({
  schoolName,
  memberships = [],
  activeSchoolId = null,
  activePersona = null,
  showBrand = true,
  showSettingsLink = false,
  onOpenMobileNav,
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
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {onOpenMobileNav ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted lg:hidden"
              aria-label="Open navigation"
              onClick={onOpenMobileNav}
            >
              <MenuIcon />
            </button>
          ) : null}
          {showBrand ? <BrandMark size="sm" showWordmark /> : null}
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
        <div className="flex shrink-0 items-center gap-2">
          {showSettingsLink ? (
            <Link
              href="/dashboard/settings"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground transition hover:bg-surface-strong"
            >
              Settings
            </Link>
          ) : null}
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
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
