import { AppHeader } from "@/components/dashboard/app-header";
import {
  OnboardingProgressBar,
  OnboardingProgressProvider,
} from "@/components/onboarding/onboarding-progress";
import { OnboardingStepper } from "@/components/onboarding/onboarding-stepper";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <AppHeader />
      <OnboardingProgressProvider>
        <OnboardingProgressBar />
        <OnboardingStepper />
        {children}
      </OnboardingProgressProvider>
    </div>
  );
}
