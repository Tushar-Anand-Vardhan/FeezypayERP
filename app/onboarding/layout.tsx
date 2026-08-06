import { AppHeader } from "@/components/dashboard/app-header";
import { OnboardingStepper } from "@/components/onboarding/onboarding-stepper";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <AppHeader />
      <OnboardingStepper />
      {children}
    </div>
  );
}
