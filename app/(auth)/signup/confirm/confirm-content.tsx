"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SubmitButton } from "@/components/auth/submit-button";
import { formatAuthError, validateEmail } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/client";

export default function SignupConfirmContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    setMessage(null);
    setError(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (resendError) {
      setError(formatAuthError(resendError));
      setLoading(false);
      return;
    }

    setMessage("Confirmation email sent. Check your inbox and spam folder.");
    setLoading(false);
  }

  return (
    <AuthShell
      title="Confirm your email"
      description="We sent a confirmation link to finish creating your account."
      notice={
        email ? (
          <>
            Sent to{" "}
            <span className="font-medium text-foreground">{email}</span>
          </>
        ) : (
          "Check the email address you used to sign up."
        )
      }
      footer={
        <>
          Ready to sign in?{" "}
          <Link
            href="/login"
            className="font-medium text-feezy-coral underline-offset-4 transition hover:text-foreground hover:underline"
          >
            Back to login
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-foreground/70">
          Didn&apos;t get the email? You can resend the confirmation link below.
        </p>

        {message ? (
          <p className="text-sm text-emerald-600">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-feezy-coral">{error}</p>
        ) : null}

        <SubmitButton
          type="button"
          loading={loading}
          disabled={!email}
          onClick={handleResend}
        >
          Resend confirmation email
        </SubmitButton>
      </div>
    </AuthShell>
  );
}
