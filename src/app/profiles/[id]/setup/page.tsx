import { redirect } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { OnboardingShell, StepHeading } from "@/components/onboarding-shell";
import { PreferencesChat } from "@/components/preferences-chat";
import { mindsConfig, mindsMode } from "@/lib/minds/config";
import { ownedProfile } from "@/lib/owned";
import { estimateSearchCost } from "@/lib/preferences";
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

  // The user's other headhunters: a way back to them, and a resume and answers to reuse.
  const others = await db.query.profiles.findMany({
    where: and(eq(schema.profiles.userId, user.id), ne(schema.profiles.id, profile.id)),
    orderBy: desc(schema.profiles.createdAt),
    columns: { id: true, label: true, status: true, resumeFileName: true, resumeData: true, preferences: true },
  });
  const working = others.find((o) => o.status === "hunting" || o.status === "paused");
  const exitHref = working ? `/app?profile=${working.id}` : undefined;
  const resumeSource = others.find((o) => o.resumeData);
  const prefsSource = others.find((o) => o.preferences)?.preferences ?? undefined;

  if (!profile.resumeData) {
    return (
      <OnboardingShell step={0} exitHref={exitHref}>
        <StepHeading eyebrow={`${profile.label} headhunter`} title="First, your resume">
          Your headhunter reads it to find jobs you fit. Everything it writes about you comes from this file, so use
          your latest version.
        </StepHeading>
        <ResumeStep
          profileId={profile.id}
          demo={mindsMode === "mock"}
          reuse={resumeSource ? { fromId: resumeSource.id, label: resumeSource.label, fileName: resumeSource.resumeFileName ?? "resume" } : undefined}
        />
      </OnboardingShell>
    );
  }

  if (!profile.preferences) {
    return (
      <OnboardingShell step={1} wide exitHref={exitHref}>
        <StepHeading eyebrow="Got it, thanks" title="What are you looking for?">
          A few quick questions, like the filters on a job site. You can change any answer later.
        </StepHeading>
        <PreferencesChat
          profileId={profile.id}
          mode="setup"
          seed={
            prefsSource && {
              country: prefsSource.country,
              city: prefsSource.city,
              workSettings: prefsSource.workSettings,
              remoteScope: prefsSource.remoteScope,
              jobTypes: prefsSource.jobTypes,
              levels: prefsSource.levels,
              minSalary: prefsSource.minSalary,
              salary: prefsSource.salary,
              avoidCompanies: prefsSource.avoidCompanies,
              needsVisa: prefsSource.needsVisa,
              jobsPerDay: prefsSource.jobsPerDay,
            }
          }
        />
      </OnboardingShell>
    );
  }

  const cost = estimateSearchCost(profile.preferences.jobsPerDay);
  return (
    <OnboardingShell step={2} exitHref={exitHref}>
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
