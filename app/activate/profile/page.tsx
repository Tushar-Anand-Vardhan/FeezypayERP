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
  const [qualification, setQualification] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [preferredSubjects, setPreferredSubjects] = useState("");
  const [preferredStandards, setPreferredStandards] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await completeProfileAction({
        fullName: fullName || null,
        phone: phone || null,
        qualification: qualification || null,
        yearsExperience: yearsExperience ? Number(yearsExperience) : null,
        preferredSubjects,
        preferredStandards: preferredStandards || null,
        bio: bio || null,
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
      description="Confirm identity details and, if you are staff, your career preferences for first-time activation."
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
        <AuthField
          id="qualification"
          label="Qualification (teachers)"
          value={qualification}
          onChange={setQualification}
        />
        <AuthField
          id="yearsExperience"
          label="Years of experience"
          value={yearsExperience}
          onChange={setYearsExperience}
          type="number"
        />
        <AuthField
          id="preferredSubjects"
          label="Preferred subjects (comma-separated)"
          value={preferredSubjects}
          onChange={setPreferredSubjects}
        />
        <AuthField
          id="preferredStandards"
          label="Preferred standards / grades"
          value={preferredStandards}
          onChange={setPreferredStandards}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Short bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
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
