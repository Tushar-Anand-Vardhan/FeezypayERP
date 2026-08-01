import { redirect } from "next/navigation";
import { DEFAULT_ONBOARDING_PATH } from "@/lib/onboarding/steps";

export default function OnboardingIndexPage() {
  redirect(DEFAULT_ONBOARDING_PATH);
}
