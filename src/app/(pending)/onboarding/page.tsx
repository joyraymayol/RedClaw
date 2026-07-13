import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/auth/onboarding-form";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Complete your profile",
};

export default async function OnboardingPage() {
  const user = await requireUser();

  if (user.status === "ACTIVE") redirect("/dashboard");
  if (user.status !== "PENDING_PROFILE") redirect("/pending-approval");

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both w-full max-w-sm duration-500">
      <OnboardingForm defaultName={user.name} />
    </div>
  );
}
