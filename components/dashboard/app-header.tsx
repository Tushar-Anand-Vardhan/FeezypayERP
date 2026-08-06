"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { SubmitButton } from "@/components/auth/submit-button";
import { createClient } from "@/lib/supabase/client";

export function AppHeader() {
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
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
        <BrandMark size="sm" showWordmark />
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
    </header>
  );
}
