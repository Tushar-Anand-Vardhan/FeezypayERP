"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { SubmitButton } from "@/components/auth/submit-button";
import { createClient } from "@/lib/supabase/client";

type AppHeaderProps = {
  schoolName?: string | null;
  onboardingComplete?: boolean;
};

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", locked: false },
  { label: "Students", href: "#", locked: true },
  { label: "Attendance", href: "#", locked: true },
  { label: "Reports", href: "#", locked: true },
  { label: "Settings", href: "#", locked: true },
] as const;

export function AppHeader({
  schoolName,
  onboardingComplete = false,
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
            const locked = item.locked && !onboardingComplete;

            if (locked) {
              return (
                <span
                  key={item.label}
                  title="Available after onboarding is complete"
                  className="cursor-not-allowed rounded-lg px-3 py-1.5 text-sm font-medium text-muted/50"
                >
                  {item.label}
                </span>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-strong hover:text-foreground"
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
