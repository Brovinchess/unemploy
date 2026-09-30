import { redirect } from "next/navigation";
import { OnboardingShell, StepHeading } from "@/components/onboarding-shell";
import { PreferencesChat } from "@/components/preferences-chat";
import { mindsConfig, mindsMode } from "@/lib/minds/config";
import { ownedProfile } from "@/lib/owned";
import { estimateDailyCost } from "@/lib/preferences";
import { requireUser } from "@/lib/session";
import { ActivateStep } from "./mind-steps";
import { ResumeStep } from "./resume-step";

// Setup is resume → preferences → activate. The step comes from what's filled in, so a
// profile made before this order changed still lands on the right screen.
export default async function Setup({ params }: PageProps<"/profiles/[id]/setup">) {
  const { id } = await params;
  const user = await requireUser();
  const profile = await ownedProfile(user, id);
  if (profile.status === "hunting" || profile.status === "paused") redirect(`/app?profile=${profile.id}`);

  if (!profile.resumeData) {
    return (
      <OnboardingShell step={0}>
        <StepHeading eyebrow={`${profile.label} headhunter`} title="First, your resume">
          Your headhunter reads it to find jobs you fit. Everything it writes about you comes from this file, so use
          your latest version.
        </StepHeading>
        <ResumeStep profileId={profile.id} demo={mindsMode === "mock"} />
      </OnboardingShell>
    );
  }

  if (!profile.preferences) {
    return (
      <OnboardingShell step={1} wide>
        <StepHeading eyebrow="Got it, thanks" title="What are you looking for?">
          A few quick questions, like the filters on a job site. You can change any answer later.
        </StepHeading>
        <PreferencesChat profileId={profile.id} mode="setup" />
      </OnboardingShell>
    );
  }

  const cost = estimateDailyCost(profile.preferences.jobsPerDay);
  return (
    <OnboardingShell step={2}>
      <StepHeading eyebrow="Last step" title={profile.mindName ? `Switch on ${profile.mindName}` : "Meet your headhunter"}>
        {profile.mindName
          ? "Your headhunter runs on cognition, the credit Hello Minds agents use to think and search. Add some and it starts right away."
          : "We'll create your own AI agent on Hello Minds. It works only for you, and you can pause it any time."}
      </StepHeading>
      <ActivateStep
        profileId={profile.id}
        mindName={profile.mindName}
        jobsPerDay={profile.preferences.jobsPerDay}
        cost={cost}
        topUpUrl={mindsConfig.topUpUrl}
        mock={mindsMode === "mock"}
      />
    </OnboardingShell>
  );
}
