"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { SubmitButton } from "@/components/auth/submit-button";
import {
  formatAuthError,
  getPasswordValidationError,
  validateEmail,
} from "@/lib/auth/validation";
import {
  fetchUserOnboardingStatus,
  getPostAuthDestination,
} from "@/lib/auth/routing";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
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
    const passwordError = getPasswordValidationError(password);
    if (passwordError) {
      nextFieldErrors.password = passwordError;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setFormError(formatAuthError(error));
      setLoading(false);
      return;
    }

    if (data.session) {
      const onboardingStatus = await fetchUserOnboardingStatus(supabase);
      router.push(getPostAuthDestination(onboardingStatus));
      router.refresh();
      return;
    }

    router.push(`/signup/confirm?email=${encodeURIComponent(email)}`);
  }

  return (
    <AuthShell
      title="Create an account"
      description="Sign up with your email and password."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-feezy-coral underline-offset-4 transition hover:text-foreground hover:underline"
          >
            Sign in
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
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            error={fieldErrors.password}
            describedBy="password-checklist"
          />
          <div id="password-checklist">
            <PasswordChecklist password={password} />
          </div>
        </div>

        {formError ? (
          <p className="text-sm text-feezy-coral">{formError}</p>
        ) : null}

        <SubmitButton loading={loading}>Create account</SubmitButton>
      </form>
    </AuthShell>
  );
}
