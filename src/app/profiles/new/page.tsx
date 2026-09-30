import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { OnboardingShell, StepHeading } from "@/components/onboarding-shell";
import { requireUser } from "@/lib/session";
import { NewProfileForm } from "./new-profile-form";

export default async function NewProfile() {
  const user = await requireUser();
  if (!user.username) redirect("/welcome");
  const existing = await db.query.profiles.findMany({ where: eq(schema.profiles.userId, user.id), columns: { id: true } });
  const first = existing.length === 0;

  return (
    <OnboardingShell>
      <StepHeading eyebrow={first ? "Your first headhunter" : "Add a headhunter"} title="What kind of jobs is this one for?">
        {first
          ? "Each headhunter focuses on one kind of job, with its own resume. You can add more later."
          : "It gets its own resume, its own daily shortlist and its own cognition, so each search stays focused."}
      </StepHeading>
      <NewProfileForm username={user.username} />
    </OnboardingShell>
  );
}
