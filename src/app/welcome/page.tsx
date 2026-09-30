import { redirect } from "next/navigation";
import { OnboardingShell, StepHeading } from "@/components/onboarding-shell";
import { requireUser } from "@/lib/session";
import { WelcomeForm } from "./welcome-form";

export default async function Welcome() {
  const user = await requireUser();
  if (user.username) redirect("/start");
  return (
    <OnboardingShell>
      <StepHeading eyebrow="Welcome to Career Ninja" title="Let's set up your headhunter">
        Two quick things, then your resume. It takes about three minutes.
      </StepHeading>
      <WelcomeForm />
    </OnboardingShell>
  );
}
