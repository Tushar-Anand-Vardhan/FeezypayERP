"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AuthField } from "@/components/auth/auth-field";
import { AuthShell } from "@/components/auth/auth-shell";
import { SubmitButton } from "@/components/auth/submit-button";
import { completeProfileAction } from "@/lib/auth/profile-completion-actions";

export default function ActivateProfilePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await completeProfileAction({
        fullName: fullName || null,
        phone: phone || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.replace(result.redirectTo);
      router.refresh();
    });
  }

  return (
    <AuthShell
      title="Complete your profile"
      description="Confirm your details to finish first-time activation."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField
          id="fullName"
          label="Full name"
          value={fullName}
          onChange={setFullName}
          autoComplete="name"
        />
        <AuthField
          id="phone"
          label="Phone"
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
        />
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <SubmitButton type="submit" loading={pending} fullWidth>
          Continue
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
