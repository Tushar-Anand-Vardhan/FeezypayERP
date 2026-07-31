import { AppHeader } from "@/components/dashboard/app-header";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader />
      {children}
    </div>
  );
}
