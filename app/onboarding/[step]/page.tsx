import { notFound } from "next/navigation";
import { ClassesForm } from "@/components/onboarding/classes-form";
import { SchoolIdentityForm } from "@/components/onboarding/school-identity-form";
import { SectionsForm } from "@/components/onboarding/sections-form";
import { SubjectsForm } from "@/components/onboarding/subjects-form";
import { TermsForm } from "@/components/onboarding/terms-form";
import { isOnboardingStepSlug } from "@/lib/onboarding/steps";

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;

  if (!isOnboardingStepSlug(step)) {
    notFound();
  }

  if (step === "school-identity") {
    return <SchoolIdentityForm />;
  }

  if (step === "terms") {
    return <TermsForm />;
  }

  if (step === "classes") {
    return <ClassesForm />;
  }

  if (step === "sections") {
    return <SectionsForm />;
  }

  return <SubjectsForm />;
}
