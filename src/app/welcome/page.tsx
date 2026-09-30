import { redirect } from "next/navigation";
import { OnboardingShell, StepHeading } from "@/components/onboarding-shell";
import { requireUser } from "@/lib/session";
import { WelcomeForm } from "./welcome-form";

export default async function Welcome() {
  const user = await requireUser();
  if (user.username) redirect("/start");
  return (
    <OnboardingShell>
      <StepHeading eyebrow="Welcome" title="What should we call you?">
        Pick a username. Your headhunters are named after it, like <em>yourname-design</em>.
      </StepHeading>
      <WelcomeForm />
    </OnboardingShell>
  );
}
