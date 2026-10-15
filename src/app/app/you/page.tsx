import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { FileText } from "lucide-react";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { Ninja } from "@/components/brand";
import { appContext, balanceFor } from "@/lib/app-context";
import { SavedAnswers } from "../settings/saved-answers";
import { QuestionList } from "./answers-ui";
import { DetailsCard } from "./details-card";

// What the headhunter answers forms from, and the few questions it couldn't answer. Action
// first (questions waiting on the person), then the facts: details, resume, saved answers.
export default async function YouPage() {
  const { user, profiles, unfinished, current } = await appContext();
  const [balance, rows] = await Promise.all([
    balanceFor(user, current),
    db.query.questions.findMany({
      // "new" and "asked" are from before the headhunter answered these itself; the person answers them.
      where: and(eq(schema.questions.userId, user.id), inArray(schema.questions.status, ["needs_you", "review", "new", "asked"])),
      orderBy: [desc(schema.questions.createdAt)],
    }),
  ]);
  const items = rows.map((r) => ({
    id: r.id,
    question: r.question,
    options: r.options ?? [],
    answer: r.status === "review" ? (r.answer ?? "") : "",
    note: r.note,
    company: r.company,
  }));
  const resumeDate = current.resumeChangedAt ?? current.createdAt;

  return (
    <AppShell tab="you" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <p className="text-sm text-white/45">About you</p>
        <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">You</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-white/55">
          Your headhunter answers form questions from what is on this page. Anything it can&rsquo;t answer lands here.
        </p>

        <div className="mt-8 space-y-4">
          {items.length ? (
            <section className="rise rise-1 rounded-3xl bg-surface p-6 md:p-8">
              <div className="flex items-start gap-4">
                <Ninja mood="thinking" className="size-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-display font-medium text-white">
                    Needs you <span className="text-white/35">{items.length}</span>
                  </h2>
                  <p className="mt-1 text-sm text-white/50">Only you know these. Answer once and you won&rsquo;t be asked again.</p>
                </div>
              </div>
              <QuestionList items={items} />
            </section>
          ) : (
            <section className="rise rise-1 flex items-center gap-4 rounded-3xl bg-surface px-6 py-5">
              <Ninja mood="happy" className="size-10 shrink-0" />
              <p className="text-sm text-white/55">Nothing needs you. Questions arrive here when you say yes to a job.</p>
            </section>
          )}

          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            <div className="space-y-4">
              <div className="rise rise-2">
                <DetailsCard initial={user.applicant ?? null} />
              </div>
              <section className="rise rise-3 flex items-center gap-4 rounded-3xl bg-surface px-6 py-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-white/60">
                  <FileText className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate text-white">{current.resumeFileName ?? "No resume yet"}</p>
                  <p className="text-white/45">
                    Resume{current.resumeFileName ? `, from ${resumeDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                  </p>
                </div>
                <Link href={`/app/headhunters/${current.id}#resume`} className="shrink-0 text-sm text-white/55 hover:text-white">
                  Replace
                </Link>
              </section>
            </div>

            <section id="saved" className="rise rise-3 scroll-mt-8 rounded-3xl bg-surface p-6 md:p-8">
              <h2 className="font-display font-medium text-white">What your headhunter knows</h2>
              <p className="mt-1 mb-4 text-sm text-white/50">Answers you&rsquo;ve given, used on the next form that asks.</p>
              <SavedAnswers answers={(user.savedAnswers ?? []).map(({ question, answer, updatedAt, field }) => ({ question, answer, updatedAt, field: field ?? null }))} />
              <p className="mt-4 text-xs text-white/30">Diversity and identity questions are never saved.</p>
            </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
