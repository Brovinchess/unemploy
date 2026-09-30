import { ExternalLink } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { PauseToggle } from "@/components/pause-toggle";
import { PreferencesChat } from "@/components/preferences-chat";
import { ResumeStep } from "@/app/profiles/[id]/setup/resume-step";
import { appContext, balanceFor } from "@/lib/app-context";
import { mindsConfig } from "@/lib/minds/config";
import { DeleteAccount } from "./delete-account";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card grid gap-6 p-6 md:grid-cols-[200px_1fr] md:p-8">
      <h2 className="font-display font-bold text-ink">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

export default async function Settings({ searchParams }: PageProps<"/app/settings">) {
  const sp = await searchParams;
  const { user, profiles, current } = await appContext(sp.profile);
  const balance = await balanceFor(user, current);

  return (
    <>
      <AppHeader tab="settings" profiles={profiles} current={current} balance={balance} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{current.label} settings</h1>

        <div className="mt-6 space-y-4">
          <Section title="Headhunter">
            <p className="font-mono text-[0.9375rem] font-semibold text-ink">{current.mindName}</p>
            <p className="mt-1 text-muted">
              {balance == null ? "Balance unavailable right now." : `${Math.round(balance)} cognition left.`}{" "}
              {current.status === "paused" ? "Paused: not searching or spending." : "Searching every morning."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={mindsConfig.topUpUrl} target="_blank" rel="noopener noreferrer" className="btn btn-accent">
                Top up <ExternalLink className="size-4" aria-hidden />
              </a>
              <PauseToggle profileId={current.id} paused={current.status === "paused"} />
            </div>
          </Section>

          <Section title="What it looks for">
            <PreferencesChat
              key={current.id + (current.briefedAt?.getTime() ?? 0)}
              profileId={current.id}
              mode="edit"
              initial={current.preferences ?? undefined}
            />
          </Section>

          <Section title="Resume">
            <p className="mb-5">
              Current: <span className="font-semibold">{current.resumeFileName}</span>
            </p>
            <ResumeStep profileId={current.id} submitLabel="Replace resume" />
          </Section>

          <Section title="Account">
            <p className="text-muted">Signed in as {user.username}.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <form action="/auth/logout" method="post">
                <button className="btn btn-ghost">Sign out</button>
              </form>
              <DeleteAccount />
            </div>
          </Section>
        </div>
      </main>
    </>
  );
}
