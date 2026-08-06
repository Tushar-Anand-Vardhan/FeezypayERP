import { notFound } from "next/navigation";
import { ClassesForm } from "@/components/onboarding/classes-form";
import { ExamsForm } from "@/components/onboarding/exams-form";
import { HousesClubsForm } from "@/components/onboarding/houses-clubs-form";
import { ReviewForm } from "@/components/onboarding/review-form";
import { SchoolIdentityForm } from "@/components/onboarding/school-identity-form";
import { SectionsForm } from "@/components/onboarding/sections-form";
import { StaffForm } from "@/components/onboarding/staff-form";
import { StudentsForm } from "@/components/onboarding/students-form";
import { SubjectsForm } from "@/components/onboarding/subjects-form";
import { TermsForm } from "@/components/onboarding/terms-form";
import { TimetableForm } from "@/components/onboarding/timetable-form";
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

  switch (step) {
    case "school-identity":
      return <SchoolIdentityForm />;
    case "terms":
      return <TermsForm />;
    case "classes":
      return <ClassesForm />;
    case "sections":
      return <SectionsForm />;
    case "subjects":
      return <SubjectsForm />;
    case "houses-clubs":
      return <HousesClubsForm />;
    case "staff":
      return <StaffForm />;
    case "students":
      return <StudentsForm />;
    case "timetable":
      return <TimetableForm />;
    case "exams":
      return <ExamsForm />;
    case "review":
      return <ReviewForm />;
    default:
      notFound();
  }
}
