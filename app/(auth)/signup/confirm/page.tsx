import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import SignupConfirmContent from "./confirm-content";

export default function SignupConfirmPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Confirm your email"
          description="Loading your confirmation details…"
        >
          <p className="text-sm text-foreground/70">Please wait…</p>
        </AuthShell>
      }
    >
      <SignupConfirmContent />
    </Suspense>
  );
}
