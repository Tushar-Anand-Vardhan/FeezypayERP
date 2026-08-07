"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { AuthShell } from "@/components/auth/auth-shell";
import { SubmitButton } from "@/components/auth/submit-button";
import { formatAuthError, validateEmail } from "@/lib/auth/validation";
import {
  fetchAuthGateState,
  getPostAuthDestination,
} from "@/lib/auth/routing";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

    const gate = await fetchAuthGateState(supabase);
    const next = searchParams.get("next");
    const safeNext =
      next && next.startsWith("/") && !next.startsWith("//") ? next : null;

    if (gate.needsProfileCompletion) {
      router.push("/activate/profile");
    } else if (safeNext) {
      router.push(safeNext);
    } else {
      router.push(
        getPostAuthDestination(gate.onboardingStatus, {
          needsProfileCompletion: gate.needsProfileCompletion,
          isSchoolAdmin: gate.isSchoolAdmin,
          hasMembership: gate.hasMembership,
        }),
      );
    }
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
        />
        {formError ? (
          <p className="text-sm text-red-600" role="alert">
            {formError}
          </p>
        ) : null}
        <SubmitButton type="submit" loading={loading} fullWidth>
          Sign in
        </SubmitButton>
        <p className="text-center text-sm text-muted">
          <Link
            href="/forgot-password"
            className="font-medium text-feezy-coral underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Welcome back" description="Loading…">
          <p className="text-sm text-muted">Loading…</p>
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
