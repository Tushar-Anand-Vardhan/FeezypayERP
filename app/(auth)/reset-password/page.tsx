import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import ResetPasswordContent from "./reset-content";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Choose a new password"
          description="Verifying your reset link…"
        >
          <p className="text-sm text-foreground/70">Please wait…</p>
        </AuthShell>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
