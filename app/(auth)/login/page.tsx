"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { AuthShell } from "@/components/auth/auth-shell";
import { SubmitButton } from "@/components/auth/submit-button";
import { formatAuthError, validateEmail } from "@/lib/auth/validation";
import {
  fetchUserOnboardingStatus,
  getPostAuthDestination,
} from "@/lib/auth/routing";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const nextFieldErrors: { email?: string; password?: string } = {};
    const emailError = validateEmail(email);
    if (emailError) {
      nextFieldErrors.email = emailError;
    }
    if (!password) {
      nextFieldErrors.password = "Password is required.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setFormError(formatAuthError(error));
      setLoading(false);
      return;
    }

    const onboardingStatus = await fetchUserOnboardingStatus(supabase);
    router.push(getPostAuthDestination(onboardingStatus));
    router.refresh();
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your account."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-feezy-coral underline-offset-4 transition hover:text-foreground hover:underline"
          >
            Sign up
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
          error={fieldErrors.email}
        />

        <div className="space-y-2">
          <AuthField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            error={fieldErrors.password}
          />
          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-muted underline-offset-4 transition hover:text-feezy-coral hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {formError ? (
          <p className="text-sm text-feezy-coral">{formError}</p>
        ) : null}

        <SubmitButton loading={loading}>Sign in</SubmitButton>
      </form>
    </AuthShell>
  );
}
