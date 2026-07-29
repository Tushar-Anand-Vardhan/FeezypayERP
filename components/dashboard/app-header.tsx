"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
    <header className="border-b border-foreground/10 bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <p className="text-sm font-medium">FeezyPay ERP</p>
        <SubmitButton
          type="button"
          fullWidth={false}
          loading={loading}
          onClick={handleLogout}
        >
          Log out
        </SubmitButton>
      </div>
    </header>
  );
}
