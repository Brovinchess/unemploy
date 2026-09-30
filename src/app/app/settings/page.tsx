import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Ninja } from "@/components/brand";
import { PauseToggle } from "@/components/pause-toggle";
import { PreferencesChat } from "@/components/preferences-chat";
import { ResumeStep } from "@/app/profiles/[id]/setup/resume-step";
import { appContext, balanceFor } from "@/lib/app-context";
import { mindsConfig } from "@/lib/minds/config";
import { DeleteAccount } from "./delete-account";
import { RemoveHeadhunter } from "./remove-headhunter";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 rounded-3xl bg-surface p-6 md:grid-cols-[220px_1fr] md:p-8">
      <h2 className="font-display font-medium text-ink">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

export default async function Settings({ searchParams }: PageProps<"/app/settings">) {
  const sp = await searchParams;
  const { user, profiles, unfinished, current } = await appContext(sp.profile);
  const balance = await balanceFor(user, current);

  return (
    <AppShell tab="settings" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <p className="text-sm text-white/45">{current.label} headhunter</p>
        <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">Settings</h1>

        <div className="mt-8 space-y-4">
          <Section title="Headhunter">
            <p className="flex items-center gap-3 font-mono text-[0.9375rem] font-semibold text-ink">
              <Ninja className="size-9" />
              {current.mindName}
            </p>
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
            <div className="mt-6 border-t border-white/[0.06] pt-5">
              <RemoveHeadhunter profileId={current.id} label={current.label} mindName={current.mindName ?? current.label} />
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
    </AppShell>
  );
}
