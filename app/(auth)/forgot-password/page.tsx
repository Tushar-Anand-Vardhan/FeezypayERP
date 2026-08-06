"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { AuthShell } from "@/components/auth/auth-shell";
import { SubmitButton } from "@/components/auth/submit-button";
import { formatAuthError, validateEmail } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setMessage(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setFieldError(emailError);
      return;
    }

    setFieldError(null);
    setLoading(true);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/confirm?next=/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setFormError(formatAuthError(error));
      setLoading(false);
      return;
    }

    setMessage(
      "If an account exists for that email, a password reset link is on its way.",
    );
    setLoading(false);
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we'll send you a reset link."
      footer={
        <>
          Remember your password?{" "}
          <Link
            href="/login"
            className="font-medium text-feezy-coral underline-offset-4 transition hover:text-foreground hover:underline"
          >
            Back to login
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          error={fieldError}
        />

        {message ? (
          <p className="text-sm text-emerald-600">
            {message}
          </p>
        ) : null}

        {formError ? (
          <p className="text-sm text-feezy-coral">{formError}</p>
        ) : null}

        <SubmitButton loading={loading}>Send reset link</SubmitButton>
      </form>
    </AuthShell>
  );
}
