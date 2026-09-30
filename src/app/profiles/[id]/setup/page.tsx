import { redirect } from "next/navigation";
import { OnboardingShell, StepHeading } from "@/components/onboarding-shell";
import { mindsConfig, mindsMode } from "@/lib/minds/config";
import { ownedProfile } from "@/lib/owned";
import { requireUser } from "@/lib/session";
import { ActivateStep, LaunchStep } from "./mind-steps";
import { ResumeStep } from "./resume-step";
import { PreferencesChat } from "@/components/preferences-chat";

export default async function Setup({ params }: PageProps<"/profiles/[id]/setup">) {
  const { id } = await params;
  const user = await requireUser();
  const profile = await ownedProfile(user, id);

  switch (profile.status) {
    case "draft":
      return (
        <OnboardingShell step={0}>
          <StepHeading eyebrow="Your headhunter" title={`Launch your ${profile.label} headhunter`}>
            We&rsquo;ll create a new Hello Minds agent that works only for you. It&rsquo;s yours: you own it, and you
            can pause it any time.
          </StepHeading>
          <LaunchStep profileId={profile.id} />
        </OnboardingShell>
      );
    case "needs_topup":
      return (
        <OnboardingShell step={1}>
          <StepHeading eyebrow="Activate" title={`Activate ${profile.mindName}`}>
            Your headhunter runs on <strong className="text-navy">cognition</strong>, the credit Hello Minds agents
            use to think and search. It starts empty, so add some now to switch it on.
          </StepHeading>
          <ActivateStep profileId={profile.id} topUpUrl={mindsConfig.topUpUrl} mock={mindsMode === "mock"} />
        </OnboardingShell>
      );
    case "needs_resume":
      return (
        <OnboardingShell step={2}>
          <StepHeading eyebrow="Your resume" title="Upload your resume">
            Your headhunter reads it to find jobs you fit. Everything it writes about you will come from this file,
            so use your most up-to-date version.
          </StepHeading>
          <ResumeStep profileId={profile.id} demo={mindsMode === "mock"} />
        </OnboardingShell>
      );
    case "needs_preferences":
      return (
        <OnboardingShell step={3}>
          <StepHeading eyebrow="Preferences" title="What are you looking for?">
            A few quick questions. You can change any answer later in Settings.
          </StepHeading>
          <PreferencesChat profileId={profile.id} mode="setup" />
        </OnboardingShell>
      );
    default:
      redirect(`/app?profile=${profile.id}`);
  }
}
