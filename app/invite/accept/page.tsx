"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SubmitButton } from "@/components/auth/submit-button";
import { acceptInviteSessionAction } from "@/lib/auth/activation-actions";

export default function InviteAcceptPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await acceptInviteSessionAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.replace(result.redirectTo);
      router.refresh();
    });
  }, [router]);

  return (
    <AuthShell
      title="Accepting invite"
      description="Linking your account to your school membership."
    >
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-sm text-muted">
          {pending ? "Please wait…" : "Finishing setup…"}
        </p>
      )}
      {error ? (
        <div className="mt-4">
          <SubmitButton
            type="button"
            onClick={() => router.push("/login")}
            fullWidth
          >
            Back to login
          </SubmitButton>
        </div>
      ) : null}
    </AuthShell>
  );
}
