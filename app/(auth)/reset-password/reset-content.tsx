"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { SubmitButton } from "@/components/auth/submit-button";
import {
  formatAuthError,
  getPasswordValidationError,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    if (searchParams.get("recovery") === "1") {
      setSessionReady(true);
      window.history.replaceState(null, "", "/reset-password");
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const passwordError = getPasswordValidationError(password);
    if (passwordError) {
      setFieldError(passwordError);
      return;
    }

    setFieldError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setFormError(formatAuthError(error));
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <AuthShell
      title="Choose a new password"
      description="Enter a new password for your account."
      notice={
        sessionReady
          ? "Reset link verified. Choose a new password below."
          : "Open the reset link from your email to continue."
      }
      footer={
        <>
          Back to{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            login
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <AuthField
            id="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            error={fieldError}
            describedBy="password-checklist"
          />
          <div id="password-checklist">
            <PasswordChecklist password={password} />
          </div>
        </div>

        {formError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
        ) : null}

        <SubmitButton loading={loading} disabled={!sessionReady}>
          Update password
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
