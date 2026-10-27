import { redirect } from "next/navigation";
import { OnboardingShell, StepHeading } from "@/components/onboarding-shell";
import { PreferencesChat } from "@/components/preferences-chat";
import { mindsMode, topUpUrlFor } from "@/lib/minds/config";
import { minds } from "@/lib/minds/client";
import { needsOwnCognition, STARTER_MINDS } from "@/lib/minds/balance";
import { ownedProfile } from "@/lib/owned";
import { PENDING_LABEL } from "@/lib/preferences";
import { requireUser } from "@/lib/session";
import { ActivateStep } from "./mind-steps";
import { NameStep } from "./name-step";
import { EmailStep } from "./email-step";
import { ResumeStep } from "./resume-step";
import { ReviewStep } from "./review-step";
import { GENERATED_PREFIX } from "@/lib/quick-resume";

// The most recent job title on the resume, as a starting answer for "which roles?".
const TITLE = /\b(manager|engineer|designer|developer|analyst|lead|director|specialist|consultant|scientist|architect|marketer|accountant|recruiter|head of|officer|associate|coordinator|strategist|product owner)\b/i;
function guessRole(resume: string | null | undefined) {
  if (!resume) return undefined;
  // Look at the first part of each line ("Senior Product Designer, PayLane (2022)" → "Senior Product Designer").
  const heads = resume
    .split(/\r?\n/)
    .slice(0, 40)
    .map((l) => l.split(/[|•·,(]/)[0].replace(/\s+(at|@)\s+.*$/i, "").trim())
    .filter((h) => h && h.length <= 60 && !/@|http|\d/.test(h));
  return heads.find((h) => TITLE.test(h)) || undefined;
}

// Setup is name → email → resume → preferences → activate. The step comes from what's filled in, so
// a profile made before this order changed still lands on the right screen.
export default async function Setup({ params, searchParams }: PageProps<"/profiles/[id]/setup">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const profile = await ownedProfile(user, id);
  if (profile.status === "hunting" || profile.status === "paused") redirect(`/app?profile=${profile.id}`);

  if (!user.username) {
    return (
      <OnboardingShell step={0}>
        <StepHeading eyebrow="Your name" title="What should we call you?">
          Your headhunter is named after you on Hello Minds. First name is fine.
        </StepHeading>
        <NameStep />
      </OnboardingShell>
    );
  }

  // The address the jobs go to, confirmed with a code before anything is sent. People whose
  // Hello Minds sign-in already gave a verified email skip this.
  if (!user.email || !user.emailVerifiedAt) {
    return (
      <OnboardingShell step={1}>
        <StepHeading eyebrow="Your email" title="Verify your email">
          We send a 6-digit code to confirm it is yours.
        </StepHeading>
        <EmailStep />
      </OnboardingShell>
    );
  }

  if (!profile.resumeData) {
    return (
      <OnboardingShell step={2}>
        <StepHeading eyebrow={profile.label === PENDING_LABEL ? "Your headhunter" : `${profile.label} headhunter`} title="First, your resume">
          Your headhunter reads it to find jobs you fit, and everything it writes about you comes from it. No resume? Answer a few blanks instead.
        </StepHeading>
        <ResumeStep profileId={profile.id} demo={mindsMode === "mock"} />
      </OnboardingShell>
    );
  }

  // A resume the app wrote from the blanks gets one look before the questions.
  if (!profile.preferences && sp.review === "1" && profile.resumeText && profile.resumeFileName?.startsWith(GENERATED_PREFIX)) {
    return (
      <OnboardingShell step={2}>
        <StepHeading eyebrow="Here's your resume" title="Does this look right?">
          Written from what you filled in. Fix anything, or leave it as it is.
        </StepHeading>
        <ReviewStep profileId={profile.id} text={profile.resumeText} />
      </OnboardingShell>
    );
  }

  if (!profile.preferences) {
    return (
      <OnboardingShell step={3} wide>
        <StepHeading eyebrow="Got it, thanks" title="What are you looking for?">
          Two quick questions, then your headhunter is ready. Everything else starts wide, and you can tighten it any time.
        </StepHeading>
        <PreferencesChat
          profileId={profile.id}
          mode="setup"
          seed={{ targetRoles: guessRole(profile.resumeText) }}
          username={user.username}
        />
      </OnboardingShell>
    );
  }

  // Before it's made: does the person already have Minds on Hello Minds? Past the 3rd, a new one
  // starts with no cognition, so they hear that now rather than after the first search.
  const deployed = !!profile.mindId;
  const ownCognition = deployed
    ? needsOwnCognition(profile)
    : await minds(user)
        .listMinds()
        .then((l) => l.length >= STARTER_MINDS)
        .catch(() => false);

  return (
    <OnboardingShell step={3}>
      <StepHeading
        eyebrow="Nearly there"
        title={profile.mindName ? (ownCognition ? `Top up to switch on ${profile.mindName}` : `Switching on ${profile.mindName}`) : "Get your headhunter"}
      >
        {profile.mindName
          ? ownCognition
            ? "Your headhunter is set up. Add cognition on Hello Minds and its first search starts by itself."
            : "Waiting for its first cognition to arrive. This usually takes a few seconds."
          : ownCognition
            ? "We'll set up your headhunter on Hello Minds. It works only for you, and you can pause it any time."
            : "We'll set up your headhunter on Hello Minds and start its first search straight away. It works only for you, and you can pause it any time."}
      </StepHeading>
      <ActivateStep
        profileId={profile.id}
        ownCognition={ownCognition}
        mindName={profile.mindName}
        topUpUrl={topUpUrlFor(profile.mindId)}
        mock={mindsMode === "mock"}
      />
    </OnboardingShell>
  );
}
