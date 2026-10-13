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
  // One headhunter per account: anyone who already has one goes back to it.
  if (existing.length > 0) redirect("/start");

  return (
    <OnboardingShell>
      <StepHeading eyebrow="Your headhunter" title="What kind of jobs is it for?">
        One headhunter, one resume. You can change what it looks for any time.
      </StepHeading>
      <NewProfileForm username={user.username} />
    </OnboardingShell>
  );
}
