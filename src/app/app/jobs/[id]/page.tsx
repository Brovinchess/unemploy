import { redirect } from "next/navigation";
import { ownedJob } from "@/lib/owned";
import { requireUser } from "@/lib/session";

// Old-style job links open the job inside the shortlist view.
export default async function JobPage({ params }: PageProps<"/app/jobs/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const { job } = await ownedJob(user, id);
  redirect(`/app?profile=${job.profileId}&job=${job.id}`);
}
